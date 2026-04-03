import asyncio
import httpx
from typing import Any, Literal

from fastapi import APIRouter, Depends, HTTPException, Query

from app.api.dependencies import get_current_user
from app.schemas.auth import AuthUser

try:
    from ddgs import DDGS
except ImportError:
    from duckduckgo_search import DDGS

router = APIRouter()

SearchType = Literal["text", "news", "images", "videos", "books"]


def _get_ddgs_class() -> type[DDGS]:
    """Return the resolved DDGS implementation.

    Both `ddgs` and `duckduckgo-search` expose a `DDGS` class. This helper keeps
    the fallback import centralized and gives call sites a stable reference.
    """
    return DDGS


def _search_wikimedia_images(query: str, max_results: int) -> list[dict[str, Any]]:
    """Fallback image search using Wikimedia Commons when DuckDuckGo is unavailable."""
    params = {
        "action": "query",
        "generator": "search",
        "gsrsearch": query,
        "gsrnamespace": "6",
        "gsrlimit": str(max_results),
        "prop": "imageinfo|info",
        "iiprop": "url",
        "iiurlwidth": "640",
        "inprop": "url",
        "format": "json",
    }

    with httpx.Client(timeout=10.0) as client:
        response = client.get("https://commons.wikimedia.org/w/api.php", params=params)
        response.raise_for_status()
        pages = response.json().get("query", {}).get("pages", {})

    results: list[dict[str, Any]] = []
    for page in pages.values():
        image_info = (page.get("imageinfo") or [{}])[0]
        image_url = image_info.get("url")
        thumbnail_url = image_info.get("thumburl") or image_url
        page_url = page.get("fullurl") or image_url
        title = (page.get("title") or "").removeprefix("File:")

        if not image_url:
            continue

        results.append(
            {
                "title": title or "Wikimedia Commons image",
                "image": image_url,
                "thumbnail": thumbnail_url,
                "url": page_url,
                "source": "Wikimedia Commons",
            }
        )

    return results


def _looks_like_network_error(exc: Exception) -> bool:
    message = str(exc).lower()
    return any(
        marker in message
        for marker in (
            "connect",
            "socket",
            "timed out",
            "timeout",
            "forbidden by its access permissions",
            "temporary failure",
            "name resolution",
            "dns",
            "network",
            "unreachable",
        )
    )


def _normalize_https_url(url: str | None) -> str | None:
    if not url:
        return None
    if url.startswith("http://"):
        return "https://" + url[len("http://"):]
    return url


def _extract_openlibrary_text(value: Any) -> str | None:
    if isinstance(value, str):
        text = value.strip()
        return text or None
    if isinstance(value, dict):
        candidate = value.get("value") or value.get("text")
        return _extract_openlibrary_text(candidate)
    if isinstance(value, list):
        for item in value:
            text = _extract_openlibrary_text(item)
            if text:
                return text
    return None


async def _fetch_openlibrary_work_description(client: httpx.AsyncClient, work_key: str | None) -> str | None:
    if not work_key:
        return None

    try:
        response = await client.get(f"https://openlibrary.org{work_key}.json", timeout=8.0)
        response.raise_for_status()
        payload = response.json()
    except Exception:
        return None

    return (
        _extract_openlibrary_text(payload.get("description"))
        or _extract_openlibrary_text(payload.get("first_sentence"))
        or _extract_openlibrary_text(payload.get("subtitle"))
    )


async def _search_openlibrary_books(query: str, max_results: int) -> list[dict[str, Any]]:
    """Fallback cho Google Books, ưu tiên dữ liệu có ảnh bìa."""
    url = "https://openlibrary.org/search.json"
    params = {
        "q": query,
        "limit": max_results,
    }

    async with httpx.AsyncClient() as client:
        response = await client.get(url, params=params, timeout=10.0)
        response.raise_for_status()
        docs = response.json().get("docs", [])

        descriptions = await asyncio.gather(
            *[_fetch_openlibrary_work_description(client, doc.get("key")) for doc in docs],
            return_exceptions=True,
        )

    results: list[dict[str, Any]] = []
    for idx, doc in enumerate(docs):
        title = doc.get("title") or "Không có tiêu đề"
        authors = doc.get("author_name") or ["Nhiều tác giả"]
        authors_str = ", ".join(authors)
        publisher = (doc.get("publisher") or [None])[0]
        published_date = str(doc.get("first_publish_year") or "N/A")
        cover_id = doc.get("cover_i")
        thumbnail = f"https://covers.openlibrary.org/b/id/{cover_id}-M.jpg" if cover_id else None
        work_key = doc.get("key")
        info_link = f"https://openlibrary.org{work_key}" if work_key else None

        raw_detail_description = descriptions[idx] if idx < len(descriptions) else None
        detail_description = None if isinstance(raw_detail_description, Exception) else raw_detail_description

        subjects = doc.get("subject") or []
        subject_preview = ", ".join(subjects[:3]) if subjects else None

        synthesized_description = (
            f"Tiểu thuyết của {authors_str}, xuất bản năm {published_date}."
            + (f" Chủ đề: {subject_preview}." if subject_preview else "")
        )

        final_description = (
            detail_description
            or _extract_openlibrary_text(doc.get("first_sentence"))
            or _extract_openlibrary_text(doc.get("subtitle"))
            or synthesized_description
        )

        isbns = doc.get("isbn") or []
        isbn_str = " | ".join(isbns[:3]) if isbns else "N/A"

        body_parts = [
            f"Tác giả: {authors_str}",
            f"Nhà xuất bản: {publisher or 'N/A'}",
            f"Xuất bản: {published_date}",
            f"ISBN: {isbn_str}",
        ]

        results.append(
            {
                "id": work_key,
                "title": title,
                "subtitle": "",
                "authors": authors,
                "publisher": publisher,
                "publishedDate": published_date,
                "description": final_description,
                "categories": ["Books"],
                "pageCount": doc.get("number_of_pages_median"),
                "language": (doc.get("language") or [None])[0],
                "averageRating": None,
                "ratingsCount": None,
                "isbn": isbn_str,
                "thumbnail": thumbnail,
                "link": info_link,
                "href": info_link,
                "previewLink": info_link,
                "buyLink": None,
                "webReaderLink": info_link,
                "body": "\n".join(body_parts),
                "source": "OpenLibrary",
                "isEbook": False,
                "pdfAvailable": False,
                "epubAvailable": False,
            }
        )

    return results

async def _search_google_books(query: str, max_results: int) -> list[dict[str, Any]]:
    """Tìm kiếm sách từ Google Books API (Miễn phí)"""
    url = "https://www.googleapis.com/books/v1/volumes"
    params = {
        "q": query,
        "maxResults": max_results,
        "printType": "books",
    }

    async with httpx.AsyncClient() as client:
        try:
            response = await client.get(url, params=params, timeout=10.0)
            response.raise_for_status()
            data = response.json()
            items = data.get("items", [])
            print(f"DEBUG: Found {len(items)} book results for query: {query}")

            results = []
            for item in items:
                info = item.get("volumeInfo", {})
                sale = item.get("saleInfo", {})
                access = item.get("accessInfo", {})
                
                authors = info.get("authors", ["Nhiều tác giả"])
                authors_str = ", ".join(authors)
                published_date = info.get("publishedDate", "N/A")
                description = info.get("description", "Không có mô tả")
                categories = info.get("categories", ["Chưa phân loại"])
                
                # Lấy ISBN
                isbns = []
                for ident in info.get("industryIdentifiers", []):
                    isbns.append(f"{ident.get('type')}: {ident.get('identifier')}")
                isbn_str = " | ".join(isbns) if isbns else "N/A"

                # Tạo body cực kỳ chi tiết
                body_parts = [
                    f"Tác giả: {authors_str}",
                    f"Nhà xuất bản: {info.get('publisher', 'N/A')}",
                    f"Xuất bản: {published_date}",
                    f"Thể loại: {', '.join(categories)}",
                    f"Số trang: {info.get('pageCount', 'N/A')} | Ngôn ngữ: {info.get('language', 'N/A').upper()}",
                    f"ISBN: {isbn_str}",
                    f"Đánh giá: {info.get('averageRating', 'Chưa có')} ⭐ ({info.get('ratingsCount', 0)} lượt)",
                    f"\n{description}"
                ]
                body_text = "\n".join(body_parts)
                
                results.append({
                    "id": item.get("id"),
                    "title": info.get("title"),
                    "subtitle": info.get("subtitle", ""),
                    "authors": authors,
                    "publisher": info.get("publisher"),
                    "publishedDate": published_date,
                    "description": description,
                    "categories": categories,
                    "pageCount": info.get("pageCount"),
                    "language": info.get("language"),
                    "averageRating": info.get("averageRating"),
                    "ratingsCount": info.get("ratingsCount"),
                    "isbn": isbn_str,
                    # Links & Media
                    "thumbnail": _normalize_https_url(
                        info.get("imageLinks", {}).get("thumbnail")
                        or info.get("imageLinks", {}).get("smallThumbnail")
                    ),
                    "link": info.get("infoLink"),
                    "href": info.get("infoLink"),
                    "previewLink": info.get("previewLink"),
                    "buyLink": sale.get("buyLink"),
                    "webReaderLink": access.get("webReaderLink"),
                    # Compatibility Fields
                    "body": body_text,
                    "source": "Google Books",
                    "isEbook": sale.get("isEbook", False),
                    "pdfAvailable": access.get("pdf", {}).get("isAvailable", False),
                    "epubAvailable": access.get("epub", {}).get("isAvailable", False)
                })
            return results
        except Exception:
            # Nếu Google Books lỗi (quota/rate-limit/network), fallback qua OpenLibrary trước.
            try:
                return await _search_openlibrary_books(query, max_results)
            except Exception:
                # Fallback cuối cùng: DuckDuckGo text search.
                ddgs_class = _get_ddgs_class()
                with ddgs_class() as ddgs:
                    return [{"title": r["title"], "link": r["href"], "body": r["body"]} for r in ddgs.text(f"{query} books", max_results=max_results)]

def _run_ddgs_search(query: str, search_type: str, max_results: int) -> list[dict[str, Any]]:
    """Hàm chạy DuckDuckGo search cho các loại non-books"""
    ddgs_class = _get_ddgs_class()
    try:
        with ddgs_class() as ddgs:
            if search_type == "news":
                return list(ddgs.news(query, max_results=max_results))
            if search_type == "images":
                return list(ddgs.images(query, max_results=max_results))
            if search_type == "videos":
                return list(ddgs.videos(query, max_results=max_results))
            return list(ddgs.text(query, max_results=max_results))
    except Exception:
        if search_type == "images":
            return _search_wikimedia_images(query, max_results)
        raise

@router.get("/duckduckgo")
async def search_duckduckgo(
    q: str = Query(..., min_length=1, description="Từ khóa tìm kiếm"),
    type: SearchType = Query("text", description="Loại tìm kiếm"),
    max_results: int = Query(10, ge=1, le=50, description="Số kết quả tối đa"),
    user: AuthUser = Depends(get_current_user),
) -> list[dict[str, Any]]:
    try:
        if type == "books":
            return await _search_google_books(q, max_results)

        # Các loại khác chạy qua thread pool để không block event loop
        return await asyncio.to_thread(_run_ddgs_search, q, type, max_results)
    except httpx.HTTPStatusError as exc:
        raise HTTPException(status_code=502, detail=f"Dich vu tim kiem tra ve loi HTTP: {exc}") from exc
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=503, detail=f"Khong the ket noi dich vu tim kiem: {exc}") from exc
    except Exception as exc:
        if _looks_like_network_error(exc):
            raise HTTPException(status_code=503, detail=f"Khong the ket noi dich vu tim kiem: {exc}") from exc
        raise HTTPException(status_code=500, detail=f"Lỗi tìm kiếm: {exc}") from exc
