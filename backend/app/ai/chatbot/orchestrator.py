from app.ai.generation.llm_client import LLMClient
from app.ai.retrieval.retriever import Retriever


class ChatbotOrchestrator:
    def __init__(self) -> None:
        self.retriever = Retriever()
        self.llm = LLMClient()

    def answer(self, material_id: str, question: str, conversation_history: list[dict] | None = None, images: list[str] | None = None) -> dict:
        contexts = self.retriever.retrieve(material_id=material_id, query=question)

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
        return {"answer": answer, "citations": citations}
