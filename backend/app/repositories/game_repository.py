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
