import logging

from app.core.config import settings

logger = logging.getLogger("ai-learning-platform")


def configure_logging() -> None:
    logging.basicConfig(
        level=settings.log_level,
        format="%(asctime)s | %(levelname)s | %(name)s | %(message)s",
        handlers=[
            logging.StreamHandler(),
            logging.FileHandler("backend_debug.log", encoding="utf-8")
        ]
    )
