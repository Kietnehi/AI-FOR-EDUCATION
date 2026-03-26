from motor.motor_asyncio import AsyncIOMotorDatabase

from app.db.mongo import get_db


async def get_database() -> AsyncIOMotorDatabase:
    return get_db()
