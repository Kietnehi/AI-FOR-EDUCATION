"""Image fetching service using the Pexels API.

Responsibilities:
  1. Search Pexels for a relevant image given an English query.
  2. Download the image to a local cache directory.
  3. Return the local file path (or ``None`` on failure).

The service is intentionally synchronous so it plugs straight into the
existing synchronous ``SlideGenerator.export_pptx`` pipeline.
"""

from __future__ import annotations

import hashlib
import time
from pathlib import Path

import httpx

from app.core.config import settings
from app.core.logging import logger

# ──────────────────────────────────────────────
# Pexels API Constants
# ──────────────────────────────────────────────
PEXELS_SEARCH_URL = "https://api.pexels.com/v1/search"
REQUEST_TIMEOUT = 15  # seconds
# Preferred image size key from Pexels response (medium ≈ 350×350 px)
PREFERRED_SIZE = "medium"


class ImageFetcher:
    """Fetch images from Pexels and cache them locally."""

    def __init__(self, cache_dir: str | None = None) -> None:
        self.api_key: str = settings.pexels_api_key
        self.cache_dir = Path(cache_dir or settings.image_cache_dir)
        self.cache_dir.mkdir(parents=True, exist_ok=True)
        self._client = httpx.Client(
            timeout=REQUEST_TIMEOUT,
            headers={"Authorization": self.api_key},
        )
        # Simple in-memory mapping query→local_path for dedup within one run
        self._query_cache: dict[str, str | None] = {}

    @property
    def available(self) -> bool:
        return bool(self.api_key)

    # ────────── Public API ──────────

    def fetch_image(self, query: str) -> str | None:
        """Search Pexels and download the best match.

        Returns the absolute path to the downloaded image, or ``None``
        if the image could not be fetched.
        """
        if not self.available:
            logger.debug("Pexels API key not configured — skipping image fetch.")
            return None

        if not query or not query.strip():
            return None

        # Check in-memory cache
        cache_key = query.strip().lower()
        if cache_key in self._query_cache:
            return self._query_cache[cache_key]

        # Check disk cache
        filename = self._query_to_filename(cache_key)
        cached = self.cache_dir / filename
        if cached.exists() and cached.stat().st_size > 0:
            path = str(cached)
            self._query_cache[cache_key] = path
            return path

        # Fetch from Pexels
        image_url = self._search_pexels(query.strip())
        if not image_url:
            self._query_cache[cache_key] = None
            return None

        local_path = self._download_image(image_url, cached)
        self._query_cache[cache_key] = local_path
        return local_path

    def fetch_images_bulk(self, queries: list[str]) -> dict[str, str | None]:
        """Fetch multiple images, returning a mapping *query → local_path*.

        Adds a small delay between API calls (0.2 s) to avoid throttling.
        """
        result: dict[str, str | None] = {}
        for i, q in enumerate(queries):
            result[q] = self.fetch_image(q)
            # Respect Pexels rate limits (200 req / hour for free tier)
            if i < len(queries) - 1:
                time.sleep(0.2)
        return result

    def close(self) -> None:
        self._client.close()

    # ────────── Private helpers ──────────

    def _search_pexels(self, query: str) -> str | None:
        """Return the URL of the best image for *query*, or ``None``."""
        try:
            resp = self._client.get(
                PEXELS_SEARCH_URL,
                params={"query": query, "per_page": 1, "orientation": "landscape"},
            )
            resp.raise_for_status()
            data = resp.json()
            photos = data.get("photos", [])
            if not photos:
                logger.info("Pexels: no results for query '%s'", query)
                return None

            photo = photos[0]
            src: dict = photo.get("src", {})
            # Prefer medium → large → original
            url = src.get(PREFERRED_SIZE) or src.get("large") or src.get("original")
            return url
        except httpx.HTTPStatusError as exc:
            logger.warning("Pexels API HTTP error: %s", exc)
            return None
        except Exception as exc:
            logger.warning("Pexels search failed for '%s': %s", query, exc)
            return None

    def _download_image(self, url: str, dest: Path) -> str | None:
        """Download *url* to *dest* and return path on success."""
        try:
            resp = self._client.get(url, follow_redirects=True)
            resp.raise_for_status()
            dest.write_bytes(resp.content)
            logger.info("Downloaded image → %s (%d KB)", dest.name, len(resp.content) // 1024)
            return str(dest)
        except Exception as exc:
            logger.warning("Image download failed (%s): %s", url, exc)
            return None

    @staticmethod
    def _query_to_filename(query: str) -> str:
        """Deterministic filename for a query string."""
        h = hashlib.md5(query.encode()).hexdigest()[:10]
        safe = "".join(c if c.isalnum() else "_" for c in query[:40])
        return f"{safe}_{h}.jpg"
