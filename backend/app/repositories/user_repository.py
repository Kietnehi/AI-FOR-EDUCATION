from bson import ObjectId
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.repositories.base import serialize_document

class UserRepository:
    def __init__(self, db: AsyncIOMotorDatabase) -> None:
        self.collection = db.users

    async def find_by_email(self, email: str) -> dict | None:
        doc = await self.collection.find_one({"email": email})
        return serialize_document(doc)

    async def create(self, payload: dict) -> dict:
        result = await self.collection.insert_one(payload)
        created = await self.collection.find_one({"_id": result.inserted_id})
        return serialize_document(created) or {}

    async def update(self, user_id: str | ObjectId, update_fields: dict) -> dict | None:
        if isinstance(user_id, str):
            user_id = ObjectId(user_id)
        await self.collection.update_one({"_id": user_id}, {"$set": update_fields})
        doc = await self.collection.find_one({"_id": user_id})
        return serialize_document(doc)
