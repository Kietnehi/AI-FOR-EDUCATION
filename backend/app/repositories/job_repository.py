from motor.motor_asyncio import AsyncIOMotorDatabase


class JobRepository:
    def __init__(self, db: AsyncIOMotorDatabase) -> None:
        self.collection = db.processing_jobs

    async def create(self, payload: dict) -> None:
        await self.collection.insert_one(payload)

    async def update_status(
        self, job_id: str, status: str, extra: dict | None = None
    ) -> None:
        updates = {"status": status}
        if extra:
            updates.update(extra)
        await self.collection.update_one({"job_id": job_id}, {"$set": updates})

    async def delete_many(self, filter: dict) -> int:
        result = await self.collection.delete_many(filter)
        return result.deleted_count
