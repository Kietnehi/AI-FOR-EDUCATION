from bson import ObjectId
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.repositories.base import serialize_document


class ChatRepository:
    def __init__(self, db: AsyncIOMotorDatabase) -> None:
        self.session_collection = db.chatbot_sessions
        self.message_collection = db.chatbot_messages

    async def create_session(self, payload: dict) -> dict:
        result = await self.session_collection.insert_one(payload)
        created = await self.session_collection.find_one({"_id": result.inserted_id})
        return serialize_document(created) or {}

    async def get_session(self, session_id: ObjectId) -> dict | None:
        return serialize_document(await self.session_collection.find_one({"_id": session_id}))

    async def update_session(self, session_id: ObjectId, update_fields: dict) -> dict | None:
        await self.session_collection.update_one({"_id": session_id}, {"$set": update_fields})
        return await self.get_session(session_id)

    async def create_message(self, payload: dict) -> dict:
        result = await self.message_collection.insert_one(payload)
        created = await self.message_collection.find_one({"_id": result.inserted_id})
        return serialize_document(created) or {}

    async def list_messages(self, session_id: str) -> list[dict]:
        cursor = self.message_collection.find({"session_id": session_id}).sort("created_at", 1)
        items = [serialize_document(doc) async for doc in cursor]
        return [item for item in items if item]
