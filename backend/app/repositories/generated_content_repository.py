from bson import ObjectId
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.repositories.base import serialize_document


class GeneratedContentRepository:
    def __init__(self, db: AsyncIOMotorDatabase) -> None:
        self.collection = db.generated_contents

    async def create(self, payload: dict) -> dict:
        result = await self.collection.insert_one(payload)
        return serialize_document({"_id": result.inserted_id, **payload}) or {}

    async def get_by_id(self, content_id: ObjectId) -> dict | None:
        return serialize_document(await self.collection.find_one({"_id": content_id}))

    async def get_by_id_for_user(self, content_id: ObjectId, user_id: str) -> dict | None:
        return serialize_document(
            await self.collection.find_one({"_id": content_id, "user_id": user_id})
        )

    async def list_by_material_and_type(self, material_id: str, content_type: str) -> list[dict]:
        cursor = self.collection.find({"material_id": material_id, "content_type": content_type}).sort("version", -1)
        items = [serialize_document(doc) async for doc in cursor]
        return [item for item in items if item]

    async def list_by_material_id(self, material_id: str) -> list[dict]:
        cursor = self.collection.find({"material_id": material_id})
        items = [serialize_document(doc) async for doc in cursor]
        return [item for item in items if item]

    async def list_by_material_id_for_user(self, material_id: str, user_id: str) -> list[dict]:
        cursor = self.collection.find({"material_id": material_id, "user_id": user_id})
        items = [serialize_document(doc) async for doc in cursor]
        return [item for item in items if item]

    async def get_next_version(self, material_id: str, content_type: str) -> int:
        latest = await self.collection.find_one(
            {"material_id": material_id, "content_type": content_type},
            sort=[("version", -1)],
            projection={"version": 1},
        )
        if not latest:
            return 1
        return int(latest.get("version", 1)) + 1

    async def delete_by_material_id(self, material_id: str) -> None:
        await self.collection.delete_many({"material_id": material_id})

    async def update(self, content_id: ObjectId, update_fields: dict) -> dict | None:
        await self.collection.update_one({"_id": content_id}, {"$set": update_fields})
        return await self.get_by_id(content_id)
