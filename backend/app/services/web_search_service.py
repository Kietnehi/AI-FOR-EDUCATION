"""
Dịch vụ tìm kiếm web hỗ trợ:
- Tìm kiếm Google với grounding cho mô hình Gemini
- Tìm kiếm Tavily như dự phòng cho các mô hình OpenAI/khác
"""

from google import genai
from google.genai import types

from app.core.config import settings
from app.core.logging import logger


class GoogleSearchService:
    """Dịch vụ tìm kiếm Google với grounding (Gemini 2.5-flash và các biến thể)"""

    def __init__(self):
        self.api_key = settings.gemini_api_key or (
            settings.gemini_api_keys[0] if settings.gemini_api_keys else ""
        )
        self.supported_models = [
            "gemini-3.1-flash-live-preview",
            "gemini-2.5-flash",
            "gemini-2.5-flash-lite",
            "gemini-2.5-flash-lite-preview-09-2025",
        ]
        self.client = None
        if self.api_key:
            try:
                self.client = genai.Client(api_key=self.api_key)
            except Exception as exc:
                logger.warning(f"Không thể khởi tạo Google GenAI client: {exc}")

    def is_available(self) -> bool:
        """Kiểm tra xem dịch vụ Tìm kiếm Google có sẵn không"""
        return self.client is not None

    def search_and_answer(
        self, query: str, model: str = "gemini-2.5-flash"
    ) -> dict:
        """
        Tìm kiếm và trả lời sử dụng Google Search với grounding

        Args:
            query: Câu hỏi tìm kiếm
            model: Mô hình Gemini để sử dụng (phải hỗ trợ grounding)

        Returns:
            dict với các khóa:
                - answer: Câu trả lời được sinh ra với trích dẫn nội tuyến
                - sources: Danh sách thông tin nguồn
                - citations: Danh sách siêu dữ liệu trích dẫn
                - raw_text: Câu trả lời thô mà không có trích dẫn nội tuyến
        """
        if not self.is_available():
            raise ValueError("Dịch vụ Tìm kiếm Google không khả dụng")

        if model not in self.supported_models:
            logger.warning(
                f"Mô hình {model} có thể không hỗ trợ grounding. Được hỗ trợ: {self.supported_models}"
            )

        try:
            # Định nghĩa công cụ Tìm kiếm Google
            grounding_tool = types.Tool(
                google_search=types.GoogleSearch()
            )

            # Cấu hình với grounding
            config = types.GenerateContentConfig(
                tools=[grounding_tool]
            )

            # Gọi API với grounding
            response = self.client.models.generate_content(
                model=model,
                contents=query,
                config=config,
            )

            # Trích xuất câu trả lời thô
            raw_text = response.text or ""

            # Trích xuất siêu dữ liệu grounding
            citations = []
            sources = []
            search_queries: list[str] = []
            meta = None

            if (
                response.candidates
                and len(response.candidates) > 0
                and response.candidates[0].grounding_metadata
            ):
                meta = response.candidates[0].grounding_metadata
                search_queries = list(getattr(meta, "web_search_queries", []) or [])

                # Trích xuất các khúc (nguồn)
                if meta.grounding_chunks:
                    for i, chunk in enumerate(meta.grounding_chunks):
                        web = getattr(chunk, "web", None)
                        title = getattr(web, "title", None) or "Không xác định"
                        uri = getattr(web, "uri", None) or ""
                        source_info = {
                            "index": i + 1,
                            "title": title,
                            "uri": uri,
                            # GroundingChunkWeb không luôn có trường snippet
                            "snippet": "",
                        }
                        sources.append(source_info)
                        citations.append(
                            {
                                "index": i + 1,
                                "title": source_info["title"],
                                "url": source_info["uri"],
                                "source": "google_search",
                            }
                        )

            # Thêm trích dẫn nội tuyến vào văn bản
            answer_with_citations = self._add_inline_citations(
                response, raw_text
            )

            return {
                "answer": answer_with_citations,
                "raw_text": raw_text,
                "sources": sources,
                "citations": citations,
                "search_queries": search_queries,
                "model": model,
                "search_provider": "google_search",
            }

        except Exception as e:
            logger.error(f"Tìm kiếm Google thất bại: {e}")
            raise

    def _add_inline_citations(self, response, text: str) -> str:
        """Thêm trích dẫn nội tuyến từ siêu dữ liệu grounding vào văn bản"""
        try:
            if not (
                response.candidates
                and len(response.candidates) > 0
                and response.candidates[0].grounding_metadata
            ):
                return text

            meta = response.candidates[0].grounding_metadata
            supports = meta.grounding_supports or []
            chunks = meta.grounding_chunks or []

            if not supports or not chunks:
                return text

            # Sắp xếp ngược để giữ các chỉ số hợp lệ khi chèn
            sorted_supports = sorted(
                supports, key=lambda s: s.segment.end_index, reverse=True
            )

            for support in sorted_supports:
                end_index = support.segment.end_index
                if support.grounding_chunk_indices:
                    citation_links = []
                    for idx in support.grounding_chunk_indices:
                        if idx < len(chunks):
                            uri = chunks[idx].web.uri if chunks[idx].web else ""
                            title = (
                                chunks[idx].web.title
                                if chunks[idx].web
                                else "Nguồn"
                            )
                            citation_links.append(
                                f"[{idx + 1}]({uri} \"{title}\")"
                            )

                    if citation_links:
                        citation_string = " " + ", ".join(citation_links)
                        text = text[:end_index] + citation_string + text[end_index:]

            return text
        except Exception as e:
            logger.warning(f"Không thể thêm trích dẫn nội tuyến: {e}")
            return text


class TavilySearchService:
    """Dịch vụ tìm kiếm Tavily (dự phòng cho các mô hình không phải Gemini)"""

    def __init__(self):
        self.tavily_api_key = settings.tavily_api_key
        self.client = None
        try:
            from tavily import TavilyClient
            if self.tavily_api_key:
                self.client = TavilyClient(api_key=self.tavily_api_key)
            else:
                logger.info("Chưa cấu hình TAVILY_API_KEY, bỏ qua Tavily search")
        except ImportError:
            logger.warning("Gói Tavily chưa được cài đặt")

    def is_available(self) -> bool:
        """Kiểm tra xem dịch vụ tìm kiếm Tavily có sẵn không"""
        return bool(self.client and self.tavily_api_key)

    def search(
        self, query: str, search_depth: str = "basic", max_results: int = 10
    ) -> dict:
        """
        Tìm kiếm sử dụng API Tavily

        Args:
            query: Câu hỏi tìm kiếm
            search_depth: "basic" hoặc "advanced"
            max_results: Số kết quả tối đa

        Returns:
            dict với:
                - results: Kết quả tìm kiếm
                - sources: Thông tin nguồn được định dạng
                - citations: Siêu dữ liệu trích dẫn
        """
        if not self.is_available():
            raise ValueError("Dịch vụ tìm kiếm Tavily không khả dụng")

        try:
            response = self.client.search(
                query=query,
                search_depth=search_depth,
                max_results=max_results,
                include_raw_content=True,
            )

            sources = []
            citations = []

            if response.get("results"):
                for i, result in enumerate(response["results"]):
                    source_info = {
                        "index": i + 1,
                        "title": result.get("title", "Không xác định"),
                        "uri": result.get("url", ""),
                        "snippet": result.get("content", result.get("snippet", ""))[:300],
                    }
                    sources.append(source_info)
                    citations.append(
                        {
                            "index": i + 1,
                            "title": source_info["title"],
                            "url": source_info["uri"],
                            "source": "tavily",
                        }
                    )

            return {
                "results": response.get("results", []),
                "sources": sources,
                "citations": citations,
                "search_provider": "tavily",
            }

        except Exception as e:
            logger.error(f"Tìm kiếm Tavily thất bại: {e}")
            raise


class WebSearchOrchestrator:
    """Điều phối viên để xử lý cả Tìm kiếm Google và Tavily với dự phòng"""

    def __init__(self):
        self.google_service = GoogleSearchService()
        self.tavily_service = TavilySearchService()

    def search_with_answer(
        self, query: str, use_google: bool = True, llm_provider: str = "gemini"
    ) -> dict:
        """
        Tìm kiếm và sinh ra câu trả lời với chiến lược dự phòng

        Args:
            query: Câu hỏi tìm kiếm
            use_google: Thử Tìm kiếm Google trước nếu True
            llm_provider: Nhà cung cấp LLM hiện tại ("gemini" hoặc "openai")

        Returns:
            dict với kết quả tìm kiếm và câu trả lời được định dạng
        """
        # Xác định chiến lược tìm kiếm
        if use_google and llm_provider == "gemini" and self.google_service.is_available():
            try:
                logger.info(f"Sử dụng Tìm kiếm Google cho câu hỏi: {query}")
                return self.google_service.search_and_answer(query)
            except Exception as e:
                logger.warning(f"Tìm kiếm Google thất bại, chuyển sang Tavily: {e}")
                if self.tavily_service.is_available():
                    return self._search_with_tavily(query)
                raise
        elif self.tavily_service.is_available():
            logger.info(f"Sử dụng tìm kiếm Tavily cho câu hỏi: {query}")
            return self._search_with_tavily(query)
        else:
            raise ValueError(
                "Không có dịch vụ tìm kiếm nào khả dụng. Hãy cấu hình GEMINI_API_KEY hoặc TAVILY_API_KEY trong file .env rồi khởi động lại backend."
            )

    def _search_with_tavily(self, query: str) -> dict:
        """Trợ giúp tìm kiếm với Tavily và định dạng phản hồi"""
        search_result = self.tavily_service.search(query, search_depth="advanced")

        # Định dạng kết quả Tavily dưới dạng câu trả lời
        answer_parts = [f"**Kết quả tìm kiếm: {query}**\n"]

        for result in search_result.get("results", []):
            title = result.get("title", "Không có tiêu đề")
            url = result.get("url", "#")
            content = result.get("content", result.get("snippet", ""))[:200]
            answer_parts.append(f"\n**[{title}]({url})**\n{content}...\n")

        return {
            "answer": "".join(answer_parts),
            "raw_text": "".join(answer_parts),
            "sources": search_result["sources"],
            "citations": search_result["citations"],
            "model": "tavily",
            "search_provider": "tavily",
        }

    def is_any_service_available(self) -> bool:
        """Kiểm tra xem có bất kỳ dịch vụ tìm kiếm nào khả dụng không"""
        return self.google_service.is_available() or self.tavily_service.is_available()
