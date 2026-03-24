from app.ai.generation.llm_client import LLMClient
from app.ai.retrieval.retriever import Retriever


class ChatbotOrchestrator:
    def __init__(self) -> None:
        self.retriever = Retriever()
        self.llm = LLMClient()

    def answer(self, material_id: str, question: str) -> dict:
        contexts = self.retriever.retrieve(material_id=material_id, query=question)

        if not contexts:
            return {
                "answer": "Toi khong tim thay du lieu lien quan trong hoc lieu da tai len, nen chua the tra loi chac chan.",
                "citations": [],
            }

        context_text = "\n\n".join(
            f"[Chunk {item['chunk_index']}] {item['chunk_text']}" for item in contexts
        )
        system_prompt = (
            "Ban la tro ly day hoc. Chi tra loi dua tren context duoc cung cap. "
            "Neu thieu du lieu, phai noi ro khong chac chan."
        )
        user_prompt = f"Cau hoi: {question}\n\nContext:\n{context_text}"

        fallback_answer = "Du lieu cho thay: " + contexts[0]["chunk_text"][:300]
        answer = self.llm.text_response(system_prompt, user_prompt, fallback_answer)

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
