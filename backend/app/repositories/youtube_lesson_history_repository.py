from __future__ import annotations

import asyncio

from bson import ObjectId
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.repositories.base import serialize_document


class YouTubeLessonHistoryRepository:
    def __init__(self, db: AsyncIOMotorDatabase) -> None:
        self.collection = db.youtube_lesson_history

    async def upsert_by_user_and_video(
        self,
        *,
        user_id: str,
        video_id: str,
        payload: dict,
        created_at,
        updated_at,
    ) -> dict:
        query = {"user_id": user_id, "video.video_id": video_id}
        existing = await self.collection.find_one(query)
        if existing:
            await self.collection.update_one(
                {"_id": existing["_id"]},
                {
                    "$set": {
                        "video": payload.get("video"),
                        "lesson": payload.get("lesson"),
                        "transcript": payload.get("transcript"),
                        "updated_at": updated_at,
                    }
                },
            )
            doc = await self.collection.find_one({"_id": existing["_id"]})
            return serialize_document(doc) or {}

        doc = {
            "user_id": user_id,
            "video": payload.get("video"),
            "lesson": payload.get("lesson"),
            "transcript": payload.get("transcript"),
            "created_at": created_at,
            "updated_at": updated_at,
        }
        result = await self.collection.insert_one(doc)
        return serialize_document({"_id": result.inserted_id, **doc}) or {}

    async def list_for_user(self, user_id: str, skip: int, limit: int) -> tuple[list[dict], int]:
        query = {"user_id": user_id}
        cursor = self.collection.find(query).sort("updated_at", -1).skip(skip).limit(limit)
        items_task = cursor.to_list(length=limit)
        total_task = self.collection.count_documents(query)
        docs, total = await asyncio.gather(items_task, total_task)
        items = [serialize_document(doc) for doc in docs]
        return [item for item in items if item], total

    async def get_for_user(self, item_id: ObjectId, user_id: str) -> dict | None:
        doc = await self.collection.find_one({"_id": item_id, "user_id": user_id})
        return serialize_document(doc)

    async def delete_for_user(self, item_id: ObjectId, user_id: str) -> bool:
        result = await self.collection.delete_one({"_id": item_id, "user_id": user_id})
        return result.deleted_count > 0
