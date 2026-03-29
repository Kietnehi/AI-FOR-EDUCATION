import asyncio

from celery import Celery

from app.core.config import settings
from app.core.logging import configure_logging, logger
from app.db.mongo import close_mongo, connect_mongo, get_db
from app.services.generation_service import GenerationService

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
)


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


async def _run_generate_minigame(material_id: str, game_type: str) -> dict:
    await connect_mongo()
    try:
        service = GenerationService(get_db())
        return await service.generate_minigame(material_id=material_id, game_type=game_type)
    finally:
        await close_mongo()


@celery_app.task(bind=True, max_retries=2, default_retry_delay=30)
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
    except Exception as exc:
        logger.exception("Generate slides task failed for material_id=%s", material_id)
        raise self.retry(exc=exc)


@celery_app.task(bind=True, max_retries=2, default_retry_delay=30)
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
    except Exception as exc:
        logger.exception("Generate podcast task failed for material_id=%s", material_id)
        raise self.retry(exc=exc)


@celery_app.task(bind=True, max_retries=2, default_retry_delay=30)
def generate_minigame_task(self, material_id: str, game_type: str) -> dict:
    configure_logging()
    logger.info("Queue generate minigame task material_id=%s", material_id)
    try:
        return asyncio.run(_run_generate_minigame(material_id=material_id, game_type=game_type))
    except Exception as exc:
        logger.exception("Generate minigame task failed for material_id=%s", material_id)
        raise self.retry(exc=exc)
