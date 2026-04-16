import asyncio

from celery import Celery
from celery.schedules import crontab
from fastapi import HTTPException

from app.core.config import settings
from app.core.logging import configure_logging, logger
from app.db.mongo import close_mongo, connect_mongo, get_db
from app.services.generation_service import GenerationService
from app.services.personalization_service import PersonalizationService

celery_app = Celery(
    "ai_tasks",
    broker=settings.celery_broker_url,
    backend=settings.celery_result_backend,
)

celery_app.conf.update(
    task_track_started=True,
    task_serializer="json",
    result_serializer="json",
    accept_content=["json"],
    timezone="UTC",
    enable_utc=True,
    result_expires=settings.celery_result_expires_seconds,
    task_soft_time_limit=settings.celery_task_soft_time_limit_seconds,
    task_time_limit=settings.celery_task_time_limit_seconds,
    worker_prefetch_multiplier=settings.celery_worker_prefetch_multiplier,
    task_acks_late=True,
    broker_connection_retry_on_startup=True,
)

celery_app.conf.beat_schedule = {
    "send-daily-learning-reminders": {
        "task": "app.tasks.send_scheduled_learning_reminders_task",
        "schedule": crontab(minute=0),  # Top of every hour
    },
}


async def _run_generate_slides(
    material_id: str,
    tone: str,
    max_slides: int,
    skip_refine: bool,
) -> dict:
    await connect_mongo()
    try:
        service = GenerationService(get_db())
        return await service.generate_slides(
            material_id=material_id,
            tone=tone,
            max_slides=max_slides,
            skip_refine=skip_refine,
        )
    finally:
        await close_mongo()


async def _run_generate_podcast(
    material_id: str,
    style: str,
    target_duration_minutes: int,
) -> dict:
    await connect_mongo()
    try:
        service = GenerationService(get_db())
        return await service.generate_podcast(
            material_id=material_id,
            style=style,
            target_duration_minutes=target_duration_minutes,
        )
    finally:
        await close_mongo()


async def _run_generate_minigame(material_id: str, game_type: str, difficulty: str) -> dict:
    await connect_mongo()
    try:
        service = GenerationService(get_db())
        return await service.generate_minigame(material_id=material_id, game_type=game_type, difficulty=difficulty)
    finally:
        await close_mongo()


@celery_app.task(bind=True, max_retries=3, default_retry_delay=30, retry_backoff=True, retry_jitter=True)
def generate_slides_task(
    self,
    material_id: str,
    tone: str,
    max_slides: int,
    skip_refine: bool = False,
) -> dict:
    configure_logging()
    logger.info("Queue generate slides task material_id=%s", material_id)
    try:
        return asyncio.run(
            _run_generate_slides(
                material_id=material_id,
                tone=tone,
                max_slides=max_slides,
                skip_refine=skip_refine,
            )
        )
    except HTTPException as exc:
        message = (
            f"Non-retriable HTTP error status={exc.status_code} "
            f"detail={exc.detail}"
        )
        logger.warning(
            "Generate slides task failed with non-retriable HTTP error for material_id=%s status=%s detail=%s",
            material_id,
            exc.status_code,
            exc.detail,
        )
        raise RuntimeError(message) from None
    except Exception as exc:
        logger.exception("Generate slides task failed for material_id=%s", material_id)
        raise self.retry(exc=exc)


@celery_app.task(bind=True, max_retries=3, default_retry_delay=30, retry_backoff=True, retry_jitter=True)
def generate_podcast_task(
    self,
    material_id: str,
    style: str,
    target_duration_minutes: int,
) -> dict:
    configure_logging()
    logger.info("Queue generate podcast task material_id=%s", material_id)
    try:
        return asyncio.run(
            _run_generate_podcast(
                material_id=material_id,
                style=style,
                target_duration_minutes=target_duration_minutes,
            )
        )
    except HTTPException as exc:
        message = (
            f"Non-retriable HTTP error status={exc.status_code} "
            f"detail={exc.detail}"
        )
        logger.warning(
            "Generate podcast task failed with non-retriable HTTP error for material_id=%s status=%s detail=%s",
            material_id,
            exc.status_code,
            exc.detail,
        )
        raise RuntimeError(message) from None
    except Exception as exc:
        logger.exception("Generate podcast task failed for material_id=%s", material_id)
        raise self.retry(exc=exc)


@celery_app.task(bind=True, max_retries=3, default_retry_delay=30, retry_backoff=True, retry_jitter=True)
def generate_minigame_task(self, material_id: str, game_type: str, difficulty: str = "medium") -> dict:
    configure_logging()
    logger.info("Queue generate minigame task material_id=%s", material_id)
    try:
        return asyncio.run(_run_generate_minigame(material_id=material_id, game_type=game_type, difficulty=difficulty))
    except HTTPException as exc:
        message = (
            f"Non-retriable HTTP error status={exc.status_code} "
            f"detail={exc.detail}"
        )
        logger.warning(
            "Generate minigame task failed with non-retriable HTTP error for material_id=%s status=%s detail=%s",
            material_id,
            exc.status_code,
            exc.detail,
        )
        raise RuntimeError(message) from None
    except Exception as exc:
        logger.exception("Generate minigame task failed for material_id=%s", material_id)
        raise self.retry(exc=exc)


async def _run_scheduled_learning_reminders() -> dict:
    await connect_mongo()
    try:
        service = PersonalizationService(get_db())
        return await service.dispatch_scheduled_reminders()
    finally:
        await close_mongo()


@celery_app.task(bind=True, max_retries=3, default_retry_delay=30, retry_backoff=True)
def send_scheduled_learning_reminders_task(self) -> dict:
    configure_logging()
    logger.info("Executing scheduled learning reminders task")
    try:
        return asyncio.run(_run_scheduled_learning_reminders())
    except Exception as exc:
        logger.exception("Scheduled learning reminders task failed")
        raise self.retry(exc=exc)
