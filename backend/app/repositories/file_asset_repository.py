from bson import ObjectId
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.repositories.base import serialize_document


class FileAssetRepository:
    def __init__(self, db: AsyncIOMotorDatabase) -> None:
        self.collection = db.file_assets

    async def create(self, payload: dict) -> dict:
        result = await self.collection.insert_one(payload)
        created = await self.collection.find_one({"_id": result.inserted_id})
        return serialize_document(created) or {}

    async def get_by_id(self, file_id: ObjectId) -> dict | None:
        return serialize_document(await self.collection.find_one({"_id": file_id}))
