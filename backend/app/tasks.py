import asyncio
from datetime import timedelta

from celery import Celery
from fastapi import HTTPException

from app.core.config import settings
from app.core.logging import configure_logging, logger
from app.db.mongo import close_mongo, connect_mongo, get_db
from app.services.generation_service import GenerationService
from app.utils.time import parse_vietnam_datetime, vietnam_now

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


async def _run_check_schedule_reminders() -> None:
    # This internal function assumes mongo is already connected 
    # (either by lifespan or the calling task wrapper).
    try:
        from app.repositories.schedule_repository import ScheduleRepository
        from app.repositories.user_repository import UserRepository
        from app.services.email_service import EmailService
        
        db = get_db()
        schedule_repo = ScheduleRepository(db)
        user_repo = UserRepository(db)
        
        # Get schedules with due events
        schedules = await schedule_repo.get_due_events()
        if schedules:
            logger.info(f"Found {len(schedules)} schedules with potential due events")
        
        for schedule in schedules:
            user_id = schedule.get("user_id")
            user = await user_repo.find_by_id(user_id)
            if not user or not user.get("email"):
                continue
            
            user_email = user.get("email")
            events = schedule.get("events", [])
            
            for i, event in enumerate(events):
                # Critical check for null events in case of corrupted data
                if not event or not isinstance(event, dict):
                    continue
                    
                if not event.get("notified"):
                    event_time = event.get("start_time", "")
                    title = event.get("title", "")
                    if not event_time or not title:
                        continue
                        
                    # Notify exactly 10 minutes before the event starts
                    try:
                        event_dt = parse_vietnam_datetime(event_time)
                    except ValueError:
                        continue
                        
                    now = vietnam_now()
                    
                    # Gửi thông báo nếu sự kiện sắp diễn ra trong khoảng 12 phút tới
                    # hoặc vừa mới bắt đầu (trong vòng 2 phút qua) để tránh sót
                    lead_time_start = now - timedelta(minutes=2)
                    lead_time_end = now + timedelta(minutes=12)
                    
                    if lead_time_start <= event_dt <= lead_time_end:
                        # 1. Ask AI to write a friendly reminder
                        try:
                            from app.ai.generation.llm_client import LLMClient
                            llm = LLMClient()
                            prompt = f"""
                            Hãy soạn một nội dung email ngắn gọn, thân thiện và chuyên nghiệp để nhắc nhở người dùng về sự kiện sắp tới.
                            Thông tin sự kiện:
                            - Tiêu đề: {title}
                            - Thời gian: {event_time}
                            - Địa điểm: {event.get('location', 'Không có')}
                            - Ghi chú: {event.get('notes', 'Không có')}
                            
                            Yêu cầu:
                            - Ngôn ngữ: Tiếng Việt.
                            - Giọng văn: Lịch sự, gần gũi như một người trợ lý AI.
                            - Độ dài: Khoảng 2-3 câu.
                            - Kết quả trả về chỉ bao gồm nội dung lời nhắn, không cần tiêu đề email.
                            """
                            ai_message = await llm.fast_generate(prompt)
                        except Exception as ai_err:
                            logger.error(f"AI Email Generation failed: {ai_err}")
                            ai_message = f"Bạn có sự kiện sắp diễn ra: {title} vào lúc {event_time}."

                        # 2. Send the email with AI content
                        logger.info(f"Sending reminder for event '{title}' to {user_email}")
                        await EmailService.send_event_reminder(
                            to_email=user_email,
                            event_title=title,
                            start_time=event_time,
                            location=event.get("location"),
                            notes=event.get("notes"),
                            ai_message=ai_message  # Pass the AI message
                        )
                        
                        # Mark as notified immediately
                        await schedule_repo.mark_event_notified(user_id, title, event_time)
    except Exception as e:
        logger.error(f"Error in check_schedule_reminders_task: {e}")


@celery_app.task(name="check_schedule_reminders")
def check_schedule_reminders_task():
    async def run_with_conn():
        await connect_mongo()
        try:
            await _run_check_schedule_reminders()
        finally:
            await close_mongo()
    asyncio.run(run_with_conn())


# Add beat schedule
celery_app.conf.beat_schedule = {
    "check-schedule-reminders-every-minute": {
        "task": "check_schedule_reminders",
        "schedule": 60.0, # Run every 60 seconds
    },
}
