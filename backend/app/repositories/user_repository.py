from bson import ObjectId
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.repositories.base import serialize_document

class UserRepository:
    def __init__(self, db: AsyncIOMotorDatabase) -> None:
        self.collection = db.users

    async def find_by_id(self, user_id: str | ObjectId) -> dict | None:
        if isinstance(user_id, str):
            user_id = ObjectId(user_id)
        doc = await self.collection.find_one({"_id": user_id})
        return serialize_document(doc)

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
<<<<<<< HEAD
=======

    async def search(self, query: str, limit: int = 10) -> list[dict]:
        if not query:
            return []
        
        # Simple case-insensitive search on email or name
        filter_query = {
            "$or": [
                {"email": {"$regex": query, "$options": "i"}},
                {"name": {"$regex": query, "$options": "i"}}
            ]
        }
        cursor = self.collection.find(filter_query).limit(limit)
        docs = await cursor.to_list(length=limit)
        return [serialize_document(doc) for doc in docs if doc]
>>>>>>> a78aa0fd5a16184ec5ef421650b3c03395164c66
