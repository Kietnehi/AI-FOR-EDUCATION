import asyncio
import sys
from concurrent.futures import ThreadPoolExecutor
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import ORJSONResponse
try:
    from prometheus_fastapi_instrumentator import Instrumentator
except ImportError:  # pragma: no cover - optional dependency fallback
    Instrumentator = None

from app.api.router import api_router
from app.core.config import settings
from app.core.logging import configure_logging, logger
from app.db.mongo import close_mongo, connect_mongo, ensure_indexes, get_db


if sys.platform.startswith("win") and sys.version_info < (3, 14):
    # Playwright async API needs subprocess support, which requires Proactor loop on Windows.
    asyncio.set_event_loop_policy(asyncio.WindowsProactorEventLoopPolicy())


@asynccontextmanager
async def lifespan(_: FastAPI):
    # Optimize ThreadPool for AI/Blocking tasks
    loop = asyncio.get_running_loop()
    loop.set_default_executor(ThreadPoolExecutor(max_workers=50))

    configure_logging()
    await connect_mongo()
    await ensure_indexes()
    
    # Initialize object storage bucket(s)
    from app.services.storage import storage_service
    if storage_service.enabled:
        try:
            storage_service.ensure_bucket_exists()
            logger.info("Object storage bucket '%s' initialized successfully", storage_service.bucket_name)
        except Exception as e:
            logger.warning("Failed to initialize object storage bucket: %s", e)
    else:
        logger.info("Object storage disabled; using local filesystem storage")
    
    logger.info("Application startup complete")
    try:
        yield
    except asyncio.CancelledError:
        # Uvicorn may cancel lifespan tasks during Ctrl+C/reload on Windows.
        logger.info("Application lifespan cancelled during shutdown")
    finally:
        await close_mongo()
        logger.info("Application shutdown complete")


app = FastAPI(
    title="AI Learning Content Platform API",
    version="0.1.0",
    lifespan=lifespan,
    default_response_class=ORJSONResponse,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# app.add_middleware(GZipMiddleware, minimum_size=1000)

if Instrumentator is not None:
    Instrumentator().instrument(app).expose(app, endpoint="/metrics", include_in_schema=False)
else:
    logger.warning("prometheus-fastapi-instrumentator is not installed; /metrics endpoint is disabled")

app.include_router(api_router, prefix="/api")


@app.get("/health")
async def health_check() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/health/ready")
async def readiness_check() -> dict[str, str]:
    try:
        await get_db().command("ping")
    except Exception:
        return {"status": "degraded", "mongo": "down", "redis": "unknown"}

    def _redis_ping() -> bool:
        from redis import Redis

        client = Redis.from_url(settings.redis_url, socket_timeout=2, socket_connect_timeout=2)
        try:
            return bool(client.ping())
        finally:
            client.close()

    try:
        redis_ok = await asyncio.to_thread(_redis_ping)
    except Exception:
        redis_ok = False

    if redis_ok:
        return {"status": "ok", "mongo": "up", "redis": "up"}
    return {"status": "degraded", "mongo": "up", "redis": "down"}


@app.get("/health/queue")
async def queue_health() -> dict[str, int | str]:
    def _queue_stats() -> tuple[int, int]:
        from redis import Redis

        broker = Redis.from_url(settings.celery_broker_url, socket_timeout=2, socket_connect_timeout=2)
        backend = Redis.from_url(settings.celery_result_backend, socket_timeout=2, socket_connect_timeout=2)
        try:
            queue_depth = int(broker.llen("celery"))
            result_db_keys = int(backend.dbsize())
            return queue_depth, result_db_keys
        finally:
            broker.close()
            backend.close()

    try:
        queue_depth, result_db_keys = await asyncio.to_thread(_queue_stats)
        return {
            "status": "ok",
            "queue_depth": queue_depth,
            "result_backend_keys": result_db_keys,
        }
    except Exception:
        return {
            "status": "degraded",
            "queue_depth": -1,
            "result_backend_keys": -1,
        }
