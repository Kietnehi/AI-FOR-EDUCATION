from __future__ import annotations

import re


def _normalize_words(text: str) -> set[str]:
    words = re.findall(r"[A-Za-z0-9_\-]{3,}", (text or "").lower())
    stop = {
        "this",
        "that",
        "with",
        "from",
        "into",
        "have",
        "about",
        "there",
        "which",
        "what",
        "when",
        "where",
        "while",
        "trong",
        "nhung",
        "cua",
        "cho",
        "theo",
        "slide",
        "chunk",
    }
    return {w for w in words if w not in stop}


def match_images_to_chunk(chunk: dict, images: list, top_k: int = 3) -> dict:
    """Match source images to chunk prioritizing page proximity over keyword overlap.

    Matching strategy:
    1. PRIMARY: Page proximity (images on same/nearby pages get highest priority)
    2. SECONDARY: Keyword overlap (when pages are equal or unknown)

    Returns:
    {
      "matched_images": [
        {"path": "...", "page": 1, "description": "...", "score": 0.62, "index": 0}
      ]
    }
    """
    chunk_title = chunk.get('title', '')
    chunk_content = chunk.get('content', '')
    chunk_page = chunk.get('page')  # Page number from text chunker

    # Extract keywords for secondary matching
    title_words = _normalize_words(chunk_title)
    content_words = _normalize_words(chunk_content)

    if not images:
        return {"matched_images": []}

    scored: list[dict] = []
    for idx, img in enumerate(images):
        description = getattr(img, "description", "") or ""
        image_page = getattr(img, "page", None)
        image_words = _normalize_words(description)

        # Calculate page proximity score (0.0 to 10.0)
        page_score = 0.0
        if chunk_page is not None and image_page is not None:
            page_distance = abs(chunk_page - image_page)
            if page_distance == 0:
                page_score = 10.0  # Same page - highest priority
            elif page_distance == 1:
                page_score = 5.0   # Adjacent page - high priority
            elif page_distance == 2:
                page_score = 2.0   # 2 pages away - medium priority
            else:
                page_score = max(0.0, 1.0 - (page_distance - 2) * 0.1)  # Decay with distance

        # Calculate keyword overlap score (0.0 to 3.0)
        keyword_score = 0.0
        if image_words:
            title_overlap = title_words.intersection(image_words)
            content_overlap = content_words.intersection(image_words)
            title_score = len(title_overlap) * 2.0
            content_score = len(content_overlap) * 1.0
            total_overlap = title_score + content_score
            keyword_score = total_overlap / max(1, len(image_words))
            keyword_score = min(keyword_score, 3.0)  # Cap at 3.0

        # COMBINED SCORE: page proximity (weight=0.7) + keyword (weight=0.3)
        # This ensures images on same/nearby pages are always preferred
        final_score = (page_score * 0.7) + (keyword_score * 0.3)

        if final_score <= 0:
            continue

        scored.append(
            {
                "index": idx,
                "path": getattr(img, "path", ""),
                "page": image_page,
                "description": description,
                "score": round(final_score, 4),
                "page_distance": abs(chunk_page - image_page) if (chunk_page and image_page) else None,
            }
        )

    scored.sort(key=lambda item: item["score"], reverse=True)
    return {"matched_images": scored[: max(1, top_k)]}
