from app.ai.embeddings.openai_embedder import OpenAIEmbedder
from app.ai.vector_store.chroma_store import ChromaVectorStore
from app.core.config import settings


class Retriever:
    def __init__(self) -> None:
        self.embedder = OpenAIEmbedder()
        self.vector_store = ChromaVectorStore()

    def retrieve(self, material_id: str, query: str) -> list[dict]:
        query_embedding = self.embedder.embed_texts([query])[0]
        result = self.vector_store.query(query_embedding, material_id=material_id, n_results=settings.retrieval_top_k)

        documents = result.get("documents", [[]])[0]
        metadatas = result.get("metadatas", [[]])[0]
        ids = result.get("ids", [[]])[0]

        retrieved: list[dict] = []
        for idx, doc in enumerate(documents):
            metadata = metadatas[idx] if idx < len(metadatas) else {}
            chunk_id = ids[idx] if idx < len(ids) else ""
            retrieved.append({
                "chunk_id": chunk_id,
                "chunk_text": doc,
                "chunk_index": metadata.get("chunk_index", idx),
                "material_id": metadata.get("material_id", material_id),
            })
        return retrieved
