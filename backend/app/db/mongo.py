from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase
from pymongo import ASCENDING, IndexModel

from app.core.config import settings
from app.core.logging import logger

_mongo_client: AsyncIOMotorClient | None = None
_database: AsyncIOMotorDatabase | None = None


async def connect_mongo() -> None:
    global _mongo_client, _database
    if _mongo_client:
        return
    _mongo_client = AsyncIOMotorClient(settings.mongo_uri)
    _database = _mongo_client[settings.mongo_db_name]
    logger.info("Connected MongoDB: %s", settings.mongo_db_name)


async def close_mongo() -> None:
    global _mongo_client, _database
    if _mongo_client:
        _mongo_client.close()
    _mongo_client = None
    _database = None


def get_db() -> AsyncIOMotorDatabase:
    if _database is None:
        raise RuntimeError("MongoDB is not connected")
    return _database


async def ensure_indexes() -> None:
    db = get_db()

    await db.users.create_indexes(
        [
            IndexModel([("email", ASCENDING)], unique=True),
            IndexModel([("role", ASCENDING), ("status", ASCENDING)]),
        ]
    )

    await db.learning_materials.create_indexes(
        [
            IndexModel([("user_id", ASCENDING), ("created_at", ASCENDING)]),
            IndexModel([("processing_status", ASCENDING)]),
            IndexModel([("subject", ASCENDING), ("education_level", ASCENDING)]),
        ]
    )

    await db.material_chunks.create_indexes(
        [
            IndexModel([("material_id", ASCENDING), ("chunk_index", ASCENDING)], unique=True),
            IndexModel([("chroma_id", ASCENDING)], unique=True),
        ]
    )

    await db.generated_contents.create_indexes(
        [
            IndexModel([("material_id", ASCENDING), ("content_type", ASCENDING), ("version", ASCENDING)]),
            IndexModel([("generation_status", ASCENDING)]),
        ]
    )

    await db.chatbot_sessions.create_indexes(
        [
            IndexModel([("user_id", ASCENDING), ("material_id", ASCENDING), ("updated_at", ASCENDING)]),
        ]
    )

    await db.chatbot_messages.create_indexes(
        [
            IndexModel([("session_id", ASCENDING), ("created_at", ASCENDING)]),
        ]
    )

    await db.mascot_chat_sessions.create_indexes(
        [
            IndexModel([("user_id", ASCENDING), ("updated_at", ASCENDING)]),
        ]
    )

    await db.mascot_chat_messages.create_indexes(
        [
            IndexModel([("session_id", ASCENDING), ("created_at", ASCENDING)]),
        ]
    )

    await db.game_attempts.create_indexes(
        [
            IndexModel([("user_id", ASCENDING), ("material_id", ASCENDING), ("completed_at", ASCENDING)]),
            IndexModel([("generated_content_id", ASCENDING)]),
        ]
    )

    await db.processing_jobs.create_indexes(
        [
            IndexModel([("job_type", ASCENDING), ("status", ASCENDING)]),
            IndexModel([("material_id", ASCENDING), ("created_at", ASCENDING)]),
        ]
    )

    await db.file_assets.create_indexes(
        [
            IndexModel([("owner_type", ASCENDING), ("owner_id", ASCENDING), ("asset_type", ASCENDING)]),
        ]
    )

    await db.audio_assets.create_indexes([IndexModel([("generated_content_id", ASCENDING)])])
    await db.slide_assets.create_indexes([IndexModel([("generated_content_id", ASCENDING)])])
    await db.analytics_events.create_indexes([IndexModel([("event_type", ASCENDING), ("created_at", ASCENDING)])])

    logger.info("MongoDB indexes ensured")
