import asyncio
import sys
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.router import api_router
from app.core.config import settings
from app.core.logging import configure_logging, logger
from app.db.mongo import close_mongo, connect_mongo, ensure_indexes


if sys.platform.startswith("win"):
    # Playwright async API needs subprocess support, which requires Proactor loop on Windows.
    asyncio.set_event_loop_policy(asyncio.WindowsProactorEventLoopPolicy())


@asynccontextmanager
async def lifespan(_: FastAPI):
    configure_logging()
    await connect_mongo()
    await ensure_indexes()
    logger.info("Application startup complete")
    yield
    await close_mongo()
    logger.info("Application shutdown complete")


app = FastAPI(
    title="AI Learning Content Platform API",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router, prefix="/api")


@app.get("/health")
async def health_check() -> dict[str, str]:
    return {"status": "ok"}
