import asyncio
import sys
from concurrent.futures import ThreadPoolExecutor
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import ORJSONResponse

from app.api.router import api_router
from app.core.config import settings
from app.core.logging import configure_logging, logger
from app.db.mongo import close_mongo, connect_mongo, ensure_indexes


if sys.platform.startswith("win"):
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
    
    # Initialize MinIO bucket
    from app.services.storage import storage_service
    if storage_service.enabled:
        try:
            storage_service.ensure_bucket_exists()
            logger.info("MinIO bucket '%s' initialized successfully", storage_service.bucket_name)
        except Exception as e:
            logger.warning("Failed to initialize MinIO bucket: %s", e)
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

app.add_middleware(GZipMiddleware, minimum_size=1000)

app.include_router(api_router, prefix="/api")


@app.get("/health")
async def health_check() -> dict[str, str]:
    return {"status": "ok"}
