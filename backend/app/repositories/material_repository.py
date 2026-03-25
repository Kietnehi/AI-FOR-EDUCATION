from __future__ import annotations

from bson import ObjectId
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.repositories.base import serialize_document


class MaterialRepository:
    def __init__(self, db: AsyncIOMotorDatabase) -> None:
        self.collection = db.learning_materials
        self.chunk_collection = db.material_chunks

    async def create(self, payload: dict) -> dict:
        result = await self.collection.insert_one(payload)
        created = await self.collection.find_one({"_id": result.inserted_id})
        return serialize_document(created) or {}

    async def get_by_id(self, material_id: ObjectId) -> dict | None:
        return serialize_document(await self.collection.find_one({"_id": material_id}))

    async def list(self, skip: int, limit: int) -> tuple[list[dict], int]:
        cursor = self.collection.find().sort("created_at", -1).skip(skip).limit(limit)
        items = [serialize_document(doc) async for doc in cursor]
        total = await self.collection.count_documents({})
        return [item for item in items if item], total

    async def update(self, material_id: ObjectId, update_fields: dict) -> dict | None:
        await self.collection.update_one({"_id": material_id}, {"$set": update_fields})
        return await self.get_by_id(material_id)

    async def replace_chunks(self, material_id: str, chunks: list[dict]) -> None:
        await self.chunk_collection.delete_many({"material_id": material_id})
        if chunks:
            await self.chunk_collection.insert_many(chunks)

    async def list_chunks(self, material_id: str) -> list[dict]:
        cursor = self.chunk_collection.find({"material_id": material_id}).sort(
            "chunk_index", 1
        )
        chunks = [serialize_document(doc) async for doc in cursor]
        return [chunk for chunk in chunks if chunk]

    async def delete(self, material_id: ObjectId) -> bool:
        await self.chunk_collection.delete_many({"material_id": str(material_id)})
        result = await self.collection.delete_one({"_id": material_id})
        return result.deleted_count > 0
