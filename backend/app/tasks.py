import asyncio

from celery import Celery
from celery.schedules import crontab
from fastapi import HTTPException

from app.core.config import settings
from app.core.logging import configure_logging, logger
from app.db.mongo import close_mongo, connect_mongo, get_db
from app.services.generation_service import GenerationService
from app.services.personalization_service import PersonalizationService
from app.services.email_service import EmailService
from app.repositories.schedule_repository import ScheduleRepository
from app.ai.generation.llm_client import LLMClient
from app.utils.time import vietnam_now, parse_vietnam_datetime
from bson import ObjectId

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


async def _run_check_schedule_reminders():
    """Logic to check and send notifications for 'Lập lịch học tập & làm việc'"""
    # Note: connect_mongo and get_db are already available in tasks.py
    logger.info("DEBUG: Entering _run_check_schedule_reminders")
    try:
        await connect_mongo()
        logger.info("DEBUG: Mongo connected in task")
        db = get_db()
        repo = ScheduleRepository(db)
        
        # 1. Get schedules with due events (logic in repo handles the 10-12 min window)
        logger.info("DEBUG: Getting due events...")
        due_schedules = await repo.get_due_events()
        logger.info(f"DEBUG: Found {len(due_schedules)} schedules")
        if not due_schedules:
            return
            
        llm = LLMClient()
        now = vietnam_now()
        
        for schedule in due_schedules:
            user_id = schedule.get("user_id")
            if not user_id:
                continue
                
            # Fetch user email - we need the users collection
            user_profile = await db.users.find_one({"_id": ObjectId(user_id)})
            if not user_profile or not user_profile.get("email"):
                continue
                
            email = user_profile["email"]
            user_name = user_profile.get("name", "người dùng")
            
            for event in schedule.get("events", []):
                # Extra check to ensure we only process events that are due right now
                if event.get("notified"):
                    continue
                    
                start_time_str = event.get("start_time")
                try:
                    event_dt = parse_vietnam_datetime(start_time_str)
                except:
                    continue
                    
                # Re-verify window: notify if starts in next 12 mins or started in last 5 mins
                diff_minutes = (event_dt - now).total_seconds() / 60
                
                if -5 <= diff_minutes <= 12:  # It's due!
                    logger.info(f"Processing reminder for {email} - Event: {event.get('title')} at {start_time_str}")
                    
                    # 2. Generate AI message (Funny & Personalized)
                    prompt = f"""
                    Bạn là một trợ lý nhắc nhở học tập và làm việc thông minh, hài hước và nhiệt huyết.
                    Hãy viết một lời nhắc nhở ngắn gọn cho người dùng về sự kiện sắp tới.
                    
                    Sự kiện: {event.get('title')}
                    Thời gian: {start_time_str}
                    Địa điểm: {event.get('location', 'Không có')}
                    Ghi chú: {event.get('notes', 'Không có')}
                    
                    Người nhận: {user_name}
                    
                    Yêu cầu: 
                    - Viết khoảng 2-3 câu. 
                    - Văn phong: Thân thiện, có thể trêu đùa một chút để tạo động lực (ví dụ: 'Đừng ngủ quên nhé!').
                    - Ngôn ngữ: Tiếng Việt.
                    """
                    
                    ai_msg = ""
                    try:
                        ai_msg = llm.generate("Bạn là trợ lý nhắc nhở AI Learning Studio.", prompt)
                    except Exception as e:
                        logger.warning(f"Failed to generate AI message for reminder: {e}")
                        ai_msg = "Sắp đến giờ cho sự kiện của bạn rồi đấy! Hãy chuẩn bị sẵn sàng nhé."
                    
                    # 3. Send Email using EmailService
                    try:
                        await EmailService.send_event_reminder(
                            to_email=email,
                            event_title=event.get("title", "Sự kiện"),
                            start_time=start_time_str,
                            location=event.get("location"),
                            notes=event.get("notes"),
                            ai_message=ai_msg
                        )
                    except Exception as e:
                        logger.error(f"Failed to send email reminder to {email}: {e}")
                        continue
                    
                    # 4. Mark as notified in DB
                    await repo.mark_event_notified(user_id, event.get("title"), start_time_str)
                    logger.info(f"Successfully notified {email} for event '{event.get('title')}'")
    except Exception as e:
        logger.error(f"Error in _run_check_schedule_reminders: {e}")
    finally:
        # Note: main.py worker handles the loop, we just do one pass
        pass
