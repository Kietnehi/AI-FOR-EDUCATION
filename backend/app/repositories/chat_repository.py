from bson import ObjectId
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.repositories.base import serialize_document


class ChatRepository:
    def __init__(self, db: AsyncIOMotorDatabase) -> None:
        self.session_collection = db.chatbot_sessions
        self.message_collection = db.chatbot_messages
        self.mascot_session_collection = db.mascot_chat_sessions
        self.mascot_message_collection = db.mascot_chat_messages

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

    async def create_mascot_session(self, payload: dict) -> dict:
        result = await self.mascot_session_collection.insert_one(payload)
        created = await self.mascot_session_collection.find_one({"_id": result.inserted_id})
        return serialize_document(created) or {}

    async def get_mascot_session(self, session_id: ObjectId) -> dict | None:
        return serialize_document(await self.mascot_session_collection.find_one({"_id": session_id}))

    async def update_mascot_session(self, session_id: ObjectId, update_fields: dict) -> dict | None:
        await self.mascot_session_collection.update_one({"_id": session_id}, {"$set": update_fields})
        return await self.get_mascot_session(session_id)

    async def create_mascot_message(self, payload: dict) -> dict:
        result = await self.mascot_message_collection.insert_one(payload)
        created = await self.mascot_message_collection.find_one({"_id": result.inserted_id})
        return serialize_document(created) or {}

    async def list_mascot_messages(self, session_id: str) -> list[dict]:
        cursor = self.mascot_message_collection.find({"session_id": session_id}).sort("created_at", 1)
        items = [serialize_document(doc) async for doc in cursor]
        return [item for item in items if item]

    async def delete_by_material_id(self, material_id: str) -> None:
        # Find all sessions for this material
        cursor = self.session_collection.find({"material_id": material_id})
        session_ids = [str(doc["_id"]) async for doc in cursor]

        if session_ids:
            # Delete messages for those sessions
            await self.message_collection.delete_many({"session_id": {"$in": session_ids}})

        # Delete the sessions themselves
        await self.session_collection.delete_many({"material_id": material_id})
