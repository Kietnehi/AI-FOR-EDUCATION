from motor.motor_asyncio import AsyncIOMotorDatabase

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

        await self.collection.update_one(
            {"user_id": user_id},
            {
                "$set": safe_updates,
                "$setOnInsert": default_payload,
            },
            upsert=True,
        )
        updated = await self.get_by_user_id(user_id)
        return updated or {**default_payload, **safe_updates}
