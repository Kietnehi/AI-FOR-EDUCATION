from typing import List, Dict, Any
from app.ai.embeddings.openai_embedder import OpenAIEmbedder
from app.ai.vector_store.chroma_store import ChromaVectorStore
from app.ai.retrieval.bm25_retriever import BM25Retriever
from app.ai.retrieval.reranker import DocumentReranker
from app.core.config import settings
from app.core.logging import logger


class Retriever:
    def __init__(self) -> None:
        self.embedder = OpenAIEmbedder()
        self.vector_store = ChromaVectorStore()
        self.reranker = DocumentReranker()

    def retrieve(self, material_id: str | list[str], query: str, corpus_chunks: List[Dict] = None) -> List[Dict]:
        """
        Retrieve chunks using Hybrid Search (Vector + BM25) and Re-rank the results.
        
        Args:
            material_id: The ID(s) of the material(s) to search in.
            query: The user query.
            corpus_chunks: Optional list of all chunks for this material (needed for BM25).
        """
        # 1. Vector Search
        query_embedding = self.embedder.embed_texts([query])[0]
        vector_results = self.vector_store.query(
            query_embedding, 
            material_id=material_id, 
            n_results=settings.retrieval_top_k * 2 # Get more for reranking
        )

        documents = vector_results.get("documents", [[]])[0]
        metadatas = vector_results.get("metadatas", [[]])[0]
        ids = vector_results.get("ids", [[]])[0]

        vector_retrieved: List[Dict] = []
        for idx, doc in enumerate(documents):
            metadata = metadatas[idx] if idx < len(metadatas) else {}
            vector_retrieved.append({
                "chunk_id": ids[idx] if idx < len(ids) else "",
                "chunk_text": doc,
                "chunk_index": metadata.get("chunk_index", idx),
                "material_id": metadata.get("material_id", str(material_id)),
                "search_type": "vector"
            })
        logger.info(f"🔍 Vector Search found {len(vector_retrieved)} relevant chunks.")

        # 2. Keyword Search (BM25) - only if corpus_chunks provided
        keyword_retrieved: List[Dict] = []
        if corpus_chunks:
            try:
                bm25_retriever = BM25Retriever(corpus_chunks)
                keyword_retrieved = bm25_retriever.retrieve(query, top_k=settings.retrieval_top_k * 2)
                for item in keyword_retrieved:
                    item["search_type"] = "keyword"
                logger.info(f"🔍 BM25 Keyword Search found {len(keyword_retrieved)} relevant chunks.")
            except Exception as e:
                logger.error(f"BM25 retrieval failed: {e}")

        # 3. Combine results (Hybrid) - Simple merge by ID for now
        combined_dict = {item["chunk_id"]: item for item in vector_retrieved}
        for item in keyword_retrieved:
            if item["chunk_id"] not in combined_dict:
                combined_dict[item["chunk_id"]] = item
        
        combined_list = list(combined_dict.values())
        logger.info(f"📊 Total unique chunks collected for Reranking: {len(combined_list)}")

        # 4. Re-ranking
        if combined_list:
            try:
                reranked = self.reranker.rerank(query, combined_list, top_k=settings.retrieval_top_k)
                
                # Log top results for proof
                logger.info(f"🏆 Final Reranked Results (Top {len(reranked)}):")
                for i, res in enumerate(reranked):
                    score = res.get("rerank_score", "N/A")
                    score_str = f"{score:.4f}" if isinstance(score, float) else "N/A"
                    logger.info(f"   {i+1}. [Score: {score_str}] [Type: {res['search_type']}] Chunk: {res['chunk_text'][:80]}...")
                
                return reranked
            except Exception as e:
                logger.error(f"Reranking failed: {e}")
                return combined_list[:settings.retrieval_top_k]
        
        return []
