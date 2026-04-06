from bson import ObjectId
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.repositories.base import serialize_document


class GameRepository:
    def __init__(self, db: AsyncIOMotorDatabase) -> None:
        self.collection = db.game_attempts

    async def create_attempt(self, payload: dict) -> dict:
        result = await self.collection.insert_one(payload)
        created = await self.collection.find_one({"_id": result.inserted_id})
        return serialize_document(created) or {}

    async def get_attempt(self, attempt_id: ObjectId) -> dict | None:
        return serialize_document(await self.collection.find_one({"_id": attempt_id}))

    async def get_attempt_for_user(self, attempt_id: ObjectId, user_id: str) -> dict | None:
        return serialize_document(
            await self.collection.find_one({"_id": attempt_id, "user_id": user_id})
        )

    async def list_attempts_for_user_material(
        self,
        user_id: str,
        material_id: str,
        limit: int = 50,
    ) -> list[dict]:
        cursor = (
            self.collection
            .find({"user_id": user_id, "material_id": material_id})
            .sort("completed_at", -1)
            .limit(limit)
        )
        items = [serialize_document(doc) async for doc in cursor]
        return [item for item in items if item]

    async def delete_by_material_id(self, material_id: str) -> None:
        await self.collection.delete_many({"material_id": material_id})
