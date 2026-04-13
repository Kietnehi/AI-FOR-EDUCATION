from datetime import datetime

from motor.motor_asyncio import AsyncIOMotorDatabase

from app.repositories.base import serialize_document


class AnalyticsEventRepository:
    def __init__(self, db: AsyncIOMotorDatabase) -> None:
        self.collection = db.analytics_events

    async def create(self, payload: dict) -> dict:
        result = await self.collection.insert_one(payload)
        created = await self.collection.find_one({"_id": result.inserted_id})
        return serialize_document(created) or {}

    async def count_recent_for_user(self, user_id: str, since: datetime) -> int:
        return await self.collection.count_documents(
            {"user_id": user_id, "created_at": {"$gte": since}}
        )

    async def get_last_for_user(self, user_id: str) -> dict | None:
        doc = await self.collection.find_one(
            {"user_id": user_id},
            sort=[("created_at", -1)],
        )
        return serialize_document(doc)
