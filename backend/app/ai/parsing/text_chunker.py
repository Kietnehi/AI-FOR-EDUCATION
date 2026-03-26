from __future__ import annotations

import re


def _token_count(text: str) -> int:
    # MVP approximation: word count is used as token proxy.
    return len(re.findall(r"\S+", text or ""))


def _extract_page_number(text: str) -> int | None:
    """Extract page number from [PAGE N] markers in text."""
    match = re.search(r"\[PAGE\s+(\d+)\]", text)
    if match:
        return int(match.group(1))
    # For DOCX [DOC_PART N] markers
    match = re.search(r"\[DOC_PART\s+(\d+)\]", text)
    if match:
        return int(match.group(1))
    return None


def _get_average_page(text: str) -> int | None:
    """Get average page number from all page markers in text."""
    pages = re.findall(r"\[PAGE\s+(\d+)\]", text)
    if not pages:
        pages = re.findall(r"\[DOC_PART\s+(\d+)\]", text)
    if pages:
        return int(sum(int(p) for p in pages) / len(pages))
    return None


def _is_heading(line: str) -> bool:
    s = (line or "").strip()
    if not s:
        return False
    if len(s) > 120:
        return False
    return bool(
        re.match(r"^(#{1,6}\s+.+)$", s)
        or re.match(r"^\d+(\.\d+)*\s+.+$", s)
        or re.match(r"^[A-Z0-9\s\-_:]{4,}$", s)
        or re.match(r"^.+:$", s)
    )


def _split_by_heading(text: str) -> list[tuple[str, str]]:
    sections: list[tuple[str, str]] = []
    current_title = "Nội dung"
    current_lines: list[str] = []

    for raw_line in (text or "").splitlines():
        line = raw_line.strip()
        if _is_heading(line):
            if current_lines:
                sections.append((current_title, "\n".join(current_lines).strip()))
                current_lines = []
            current_title = re.sub(r"^#{1,6}\s*", "", line).strip()
            continue
        current_lines.append(raw_line)

    if current_lines:
        sections.append((current_title, "\n".join(current_lines).strip()))

    return [(title, content) for title, content in sections if content]


def _paragraph_token_chunks(
    text: str,
    chunk_size: int,
    overlap: int,
) -> list[dict]:
    paragraphs = [p.strip() for p in re.split(r"\n\s*\n", text or "") if p.strip()]
    chunks: list[dict] = []
    current: list[str] = []
    current_tokens = 0
    chunk_id = 1

    def flush() -> None:
        nonlocal chunk_id, current, current_tokens
        if not current:
            return
        content = "\n\n".join(current).strip()
        title = current[0].split("\n", 1)[0][:96].strip() or f"Chunk {chunk_id}"
        page = _get_average_page(content)
        chunks.append({
            "chunk_id": chunk_id,
            "title": title,
            "content": content,
            "page": page
        })
        chunk_id += 1

        # Keep tail paragraphs for overlap.
        kept: list[str] = []
        kept_tokens = 0
        for paragraph in reversed(current):
            p_tokens = _token_count(paragraph)
            if kept_tokens + p_tokens > overlap:
                break
            kept.insert(0, paragraph)
            kept_tokens += p_tokens
        current = kept
        current_tokens = kept_tokens

    for paragraph in paragraphs:
        p_tokens = _token_count(paragraph)
        if current_tokens + p_tokens > chunk_size and current:
            flush()
        current.append(paragraph)
        current_tokens += p_tokens

    flush()
    return chunks


def split_text_into_chunks(
    text: str,
    chunk_size_tokens: int = 500,
    overlap_tokens: int = 80,
) -> list[dict]:
    """Split source text into semantic chunks with page tracking.

    Rules:
    - Prefer heading-aware split first.
    - Fallback to paragraph chunks with token overlap.
    - Output schema includes page number for proximity matching.
    """
    content = (text or "").strip()
    if not content:
        return []

    chunk_size_tokens = max(300, min(700, chunk_size_tokens))
    overlap_tokens = max(50, min(100, overlap_tokens))

    sections = _split_by_heading(content)
    if len(sections) >= 2:
        result: list[dict] = []
        chunk_id = 1
        for title, section_text in sections:
            page = _get_average_page(section_text)

            if _token_count(section_text) <= chunk_size_tokens:
                result.append(
                    {
                        "chunk_id": chunk_id,
                        "title": title or f"Chunk {chunk_id}",
                        "content": section_text,
                        "page": page,
                    }
                )
                chunk_id += 1
                continue

            sub_chunks = _paragraph_token_chunks(
                section_text,
                chunk_size=chunk_size_tokens,
                overlap=overlap_tokens,
            )
            for i, sub in enumerate(sub_chunks, start=1):
                result.append(
                    {
                        "chunk_id": chunk_id,
                        "title": f"{title} ({i})",
                        "content": sub["content"],
                        "page": sub.get("page") or page,
                    }
                )
                chunk_id += 1
        return result

    return _paragraph_token_chunks(
        content,
        chunk_size=chunk_size_tokens,
        overlap=overlap_tokens,
    )
