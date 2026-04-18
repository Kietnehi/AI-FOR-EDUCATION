from app.ai.generation.llm_client import LLMClient
from app.ai.retrieval.retriever import Retriever
from app.core.config import settings
from app.core.logging import logger
from app.services.web_search_service import WebSearchOrchestrator


class ChatbotOrchestrator:
    def __init__(self) -> None:
        self.retriever = Retriever()
        self.llm = LLMClient()
        self.web_search_orchestrator = WebSearchOrchestrator()

    def answer(self, material_id: str, question: str, conversation_history: list[dict] | None = None, images: list[str] | None = None, model: str | None = None, reasoning_enabled: bool = False, use_gemini_rotation: bool = True, corpus_chunks: list[dict] | None = None) -> dict:
        contexts = self.retriever.retrieve(material_id=material_id, query=question, corpus_chunks=corpus_chunks)

        if not contexts:
            return {
                "answer": "Tôi không tìm thấy dữ liệu liên quan trong học liệu đã tải lên, nên chưa thể trả lời chắc chắn.",
                "citations": [],
            }

        context_text = "\n\n".join(
            f"[Chunk {item['chunk_index']}] {item['chunk_text']}" for item in contexts
        )
        system_prompt = (
            "Bạn là trợ lý dạy học. Chỉ trả lời dựa trên context được cung cấp, BẮT BUỘC bằng tiếng Việt có dấu đầy đủ, chuẩn xác. "
            "Nếu thiếu dữ liệu, phải nói rõ là không chắc chắn. "
            "Luôn ưu tiên bám theo mạch hội thoại gần đây nếu có."
        )
        history_text = ""
        if conversation_history:
            turns: list[str] = []
            for item in conversation_history:
                role = "User" if item.get("role") == "user" else "Assistant"
                message = str(item.get("message", "")).strip()
                if not message:
                    continue
                turns.append(f"{role}: {message[:400]}")
            if turns:
                history_text = "\n\nLịch sử hội thoại gần đây:\n" + "\n".join(turns)

        user_prompt = f"Câu hỏi hiện tại: {question}{history_text}\n\nContext:\n{context_text}"

        fallback_answer = "Dữ liệu cho thấy: " + contexts[0]["chunk_text"][:300]
        reasoning_details = None

        if model:
            messages = [{"role": "system", "content": system_prompt}]
            if conversation_history:
                for item in conversation_history:
                    msg_role = "user" if item.get("role") == "user" else "assistant"
                    msg_content = str(item.get("message", "")).strip()
                    if not msg_content:
                        continue
                    msg = {"role": msg_role, "content": msg_content}
                    if item.get("reasoning_details"):
                        msg["reasoning_details"] = item["reasoning_details"]
                    messages.append(msg)
            
            user_content = [{"type": "text", "text": f"Câu hỏi hiện tại: {question}\n\nContext:\n{context_text}"}]
            if images:
                import base64
                for img in images:
                    if img.startswith("data:"):
                        user_content.append({"type": "image_url", "image_url": {"url": img}})
                    else:
                        user_content.append({"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{img}"}})
            messages.append({"role": "user", "content": user_content})

            answer, reasoning_details = self.llm.text_chat_unified(
                messages=messages,
                fallback=fallback_answer,
                model=model,
                reasoning_enabled=reasoning_enabled,
                use_gemini_rotation=use_gemini_rotation,
            )
        else:
            answer = self.llm.text_response(system_prompt, user_prompt, fallback_answer, images=images)

        citations = [
            {
                "material_id": item["material_id"],
                "chunk_id": item["chunk_id"],
                "chunk_index": item["chunk_index"],
                "snippet": item["chunk_text"][:220],
            }
            for item in contexts
        ]
        return {"answer": answer, "citations": citations, "reasoning_details": reasoning_details}

    def stream_answer(self, material_id: str, question: str, conversation_history: list[dict] | None = None, images: list[str] | None = None, model: str | None = None, reasoning_enabled: bool = False, use_gemini_rotation: bool = True, corpus_chunks: list[dict] | None = None):
        contexts = self.retriever.retrieve(material_id=material_id, query=question, corpus_chunks=corpus_chunks)

        if not contexts:
            yield {"answer": "Tôi không tìm thấy dữ liệu liên quan trong học liệu đã tải lên, nên chưa thể trả lời chắc chắn.", "citations": []}
            return

        context_text = "\n\n".join(
            f"[Chunk {item['chunk_index']}] {item['chunk_text']}" for item in contexts
        )
        system_prompt = (
            "Bạn là trợ lý dạy học. Chỉ trả lời dựa trên context được cung cấp, BẮT BUỘC bằng tiếng Việt có dấu đầy đủ, chuẩn xác. "
            "Nếu thiếu dữ liệu, phải nói rõ là không chắc chắn. "
            "Luôn ưu tiên bám theo mạch hội thoại gần đây nếu có."
        )

        messages = [{"role": "system", "content": system_prompt}]
        if conversation_history:
            for item in conversation_history:
                msg_role = "user" if item.get("role") == "user" else "assistant"
                msg_content = str(item.get("message", "")).strip()
                if not msg_content:
                    continue
                msg = {"role": msg_role, "content": msg_content}
                if item.get("reasoning_details"):
                    msg["reasoning_details"] = item["reasoning_details"]
                messages.append(msg)
        
        user_content = [{"type": "text", "text": f"Câu hỏi hiện tại: {question}\n\nContext:\n{context_text}"}]
        if images:
            import base64
            for img in images:
                if img.startswith("data:"):
                    user_content.append({"type": "image_url", "image_url": {"url": img}})
                else:
                    user_content.append({"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{img}"}})
        messages.append({"role": "user", "content": user_content})

        citations = [
            {
                "material_id": item["material_id"],
                "chunk_id": item["chunk_id"],
                "chunk_index": item["chunk_index"],
                "snippet": item["chunk_text"][:220],
            }
            for item in contexts
        ]
        
        # Initial chunk with citations
        yield {"citations": citations}

        gen = self.llm.stream_chat_unified(
            messages=messages,
            model=model,
            reasoning_enabled=reasoning_enabled,
            use_gemini_rotation=use_gemini_rotation,
        )
        
        for chunk in gen:
            yield chunk

    def web_search(self, query: str, use_google: bool = True) -> dict:
        """
        Tìm kiếm web sử dụng Tìm kiếm Google hoặc Tavily với sinh tạo câu trả lời

        Args:
            query: Câu hỏi tìm kiếm
            use_google: Thử Tìm kiếm Google trước nếu True

        Returns:
            dict với kết quả tìm kiếm và câu trả lời
        """
        try:
            logger.info(f"Bắt đầu tìm kiếm web cho câu hỏi: {query}")
            
            # Xác định nhà cung cấp dựa trên LLM hiện tại và tính khả dụng
            llm_provider = settings.llm_provider
            
            result = self.web_search_orchestrator.search_with_answer(
                query=query,
                use_google=use_google,
                llm_provider=llm_provider,
            )
            
            logger.info(f"Tìm kiếm web thành công sử dụng {result.get('search_provider')}")
            return result
            
        except Exception as e:
            logger.error(f"Tìm kiếm web thất bại: {e}")
            raise
