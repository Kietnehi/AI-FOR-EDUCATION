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
                    "thumbnail": info.get("imageLinks", {}).get("thumbnail") or info.get("imageLinks", {}).get("smallThumbnail"),
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
        except Exception as e:
            # Nếu Google Books lỗi, fallback về DuckDuckGo text search
            with DDGS() as ddgs:
                return [{"title": r["title"], "link": r["href"], "body": r["body"]} for r in ddgs.text(f"{query} books", max_results=max_results)]

def _run_ddgs_search(query: str, search_type: str, max_results: int) -> list[dict[str, Any]]:
    """Hàm chạy DuckDuckGo search cho các loại non-books"""
    with DDGS() as ddgs:
        if search_type == "news":
            return list(ddgs.news(query, max_results=max_results))
        if search_type == "images":
            return list(ddgs.images(query, max_results=max_results))
        if search_type == "videos":
            return list(ddgs.videos(query, max_results=max_results))
        return list(ddgs.text(query, max_results=max_results))

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
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Lỗi tìm kiếm: {exc}") from exc
