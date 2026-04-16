from motor.motor_asyncio import AsyncIOMotorDatabase

from app.core.config import settings
from app.repositories.base import serialize_document
from app.utils.time import utc_now


class UserPreferencesRepository:
    def __init__(self, db: AsyncIOMotorDatabase) -> None:
        self.collection = db.user_preferences

    @staticmethod
    def _build_default(user_id: str) -> dict:
        now = utc_now()
        return {
            "user_id": user_id,
            "theme": "system",
            "mascot_enabled": True,
            "chat_model_id": "openai/gpt-4o-mini",
            "chat_model_name": "GPT-4o Mini",
            "chat_model_supports_reasoning": False,
            "chat_use_gemini_rotation": True,
            "chat_custom_models": [],
            "preferred_language": "vi",
            "learning_pace": "moderate",
            "study_goal": None,
            "reminder_timezone": settings.personalization_default_timezone,
            "reminder_hour_local": settings.personalization_default_reminder_hour_local,
            "reminder_days_of_week": settings.personalization_reminder_default_days_of_week,
            "reminder_in_app_enabled": True,
            "reminder_email_enabled": True,
            "reminder_last_email_sent_date": None,
            "weekly_goal_active_days": settings.personalization_weekly_goal_default_active_days,
            "weekly_goal_minutes": settings.personalization_weekly_goal_default_minutes,
            "weekly_goal_items": settings.personalization_weekly_goal_default_items,
            "streak_current_days": 0,
            "streak_longest_days": 0,
            "streak_last_checkin_date": None,
            "streak_total_checkins": 0,
            "streak_freeze_used_week": 0,
            "streak_freeze_week_start": None,
            "streak_last_freeze_date": None,
            "sidebar_order": [],
            "created_at": now,
            "updated_at": now,
        }

    async def get_by_user_id(self, user_id: str) -> dict | None:
        doc = await self.collection.find_one({"user_id": user_id})
        return serialize_document(doc)

    async def get_or_create_by_user_id(self, user_id: str) -> dict:
        doc = await self.get_by_user_id(user_id)
        if doc:
            return doc

        default_payload = self._build_default(user_id)
        await self.collection.update_one(
            {"user_id": user_id},
            {"$setOnInsert": default_payload},
            upsert=True,
        )

        created = await self.get_by_user_id(user_id)
        return created or default_payload

    async def upsert_by_user_id(self, user_id: str, update_fields: dict) -> dict:
        now = utc_now()
        default_payload = self._build_default(user_id)
        safe_updates = {**update_fields, "updated_at": now}
        
        safe_set_on_insert = {
            k: v for k, v in default_payload.items() if k not in safe_updates
        }

        await self.collection.update_one(
            {"user_id": user_id},
            {
                "$set": safe_updates,
                "$setOnInsert": safe_set_on_insert,
            },
            upsert=True,
        )
        updated = await self.get_by_user_id(user_id)
        return updated or {**default_payload, **safe_updates}
