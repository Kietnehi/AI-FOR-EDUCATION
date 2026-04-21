import asyncio

from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase
from pymongo import ASCENDING, IndexModel

from app.core.config import settings
from app.core.logging import logger

_mongo_client: AsyncIOMotorClient | None = None
_database: AsyncIOMotorDatabase | None = None
_mongo_event_loop: asyncio.AbstractEventLoop | None = None


async def connect_mongo() -> None:
    """Connect to MongoDB.

    Motor (AsyncIOMotorClient) is bound to the event loop that created it.
    In Celery workers each task runs inside ``asyncio.run()``, which creates a
    *new* event loop.  Reusing a client that was bound to a previous (now
    closed) loop raises ``RuntimeError: Task attached to a different loop``.

    We therefore track which loop owns the current client and force
    re-initialisation whenever the running loop changes.
    """
    global _mongo_client, _database, _mongo_event_loop
    try:
        current_loop = asyncio.get_running_loop()
    except RuntimeError:
        current_loop = None

    # Re-create the client if it belongs to a different (closed) event loop.
    if _mongo_client is not None and _mongo_event_loop is not current_loop:
        logger.info(
            "Event loop changed – closing stale MongoDB client and reconnecting"
        )
        try:
            _mongo_client.close()
        except Exception:  # pragma: no cover
            pass
        _mongo_client = None
        _database = None
        _mongo_event_loop = None

    if _mongo_client:
        return

    _mongo_client = AsyncIOMotorClient(
        settings.mongo_uri,
        maxPoolSize=100,
        minPoolSize=10,
        maxIdleTimeMS=60000,
        connectTimeoutMS=5000,
        serverSelectionTimeoutMS=5000,
        compressors="zlib",  # Enable wire compression
        zlibCompressionLevel=1,
    )
    _database = _mongo_client[settings.mongo_db_name]
    _mongo_event_loop = current_loop
    logger.info("Connected MongoDB: %s", settings.mongo_db_name)


async def close_mongo() -> None:
    global _mongo_client, _database, _mongo_event_loop
    if _mongo_client:
        _mongo_client.close()
    _mongo_client = None
    _database = None
    _mongo_event_loop = None


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

    await db.user_preferences.create_indexes(
        [
            IndexModel([("user_id", ASCENDING)], unique=True),
            IndexModel([("updated_at", ASCENDING)]),
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
            IndexModel([("job_id", ASCENDING)], unique=True),
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
    await db.analytics_events.create_indexes(
        [
            IndexModel([("event_type", ASCENDING), ("created_at", ASCENDING)]),
            IndexModel([("user_id", ASCENDING), ("created_at", ASCENDING)]),
            IndexModel(
                [("resource_type", ASCENDING), ("resource_id", ASCENDING), ("created_at", ASCENDING)]
            ),
            IndexModel([("expires_at", ASCENDING)], expireAfterSeconds=0),
        ]
    )

    await db.youtube_lesson_history.create_indexes(
        [
            IndexModel([("user_id", ASCENDING), ("video.video_id", ASCENDING)], unique=True),
            IndexModel([("user_id", ASCENDING), ("updated_at", ASCENDING)]),
        ]
    )

    logger.info("MongoDB indexes ensured")
