from flashrank import Ranker, RerankRequest
from app.core.logging import logger
from app.ai.generation.llm_client import LLMClient
from typing import List, Dict
import json

class DocumentReranker:
    def __init__(self, model_name: str = "ms-marco-MiniLM-L-12-v2"):
        self.ranker = None
        self.llm = LLMClient()
        try:
            # Try to initialize local ranker
            self.ranker = Ranker(model_name=model_name, cache_dir="/tmp/flashrank_cache")
            logger.info(f"FlashRank initialized with model: {model_name}")
        except Exception as e:
            logger.warning(f"Failed to initialize FlashRank local model '{model_name}': {e}. Will use LLM fallback.")

    def rerank(self, query: str, documents: List[Dict], top_k: int = 5) -> List[Dict]:
        if not documents:
            return []

        # 1. Try Local Reranking with FlashRank
        if self.ranker:
            try:
                flash_docs = []
                for i, doc in enumerate(documents):
                    flash_docs.append({
                        "id": i, 
                        "text": doc["chunk_text"],
                        "meta": doc
                    })

                rerank_request = RerankRequest(query=query, passages=flash_docs)
                results = self.ranker.rerank(rerank_request)

                reranked_docs = []
                for res in results[:top_k]:
                    original_doc = documents[res["id"]]
                    original_doc["rerank_score"] = float(res["score"])
                    reranked_docs.append(original_doc)
                return reranked_docs
            except Exception as e:
                logger.error(f"FlashRank reranking failed: {e}. Falling back to LLM.")

        # 2. Fallback: Use Gemini for Reranking
        try:
            return self._rerank_with_llm(query, documents, top_k)
        except Exception as e:
            logger.error(f"LLM reranking failed: {e}. Returning original order.")
            return documents[:top_k]

    def _rerank_with_llm(self, query: str, documents: List[Dict], top_k: int = 5) -> List[Dict]:
        """Use LLM to select top-k most relevant documents."""
        context_str = "\n".join([f"ID: {i} | Content: {doc['chunk_text'][:500]}" for i, doc in enumerate(documents)])
        
        system_prompt = (
            "You are an expert at information retrieval. Your task is to rank the relevance of the following documents to the user's query. "
            f"Return only a JSON list of the top {top_k} IDs in order of relevance, like [1, 0, 4]. No explanation."
        )
        user_prompt = f"Query: {query}\n\nDocuments:\n{context_str}\n\nTop {top_k} IDs:"
        
        response = self.llm.text_response(system_prompt, user_prompt, fallback="[]")
        
        try:
            # Extract JSON list from response
            import re
            match = re.search(r"\[.*\]", response)
            if match:
                top_ids = json.loads(match.group(0))
                reranked = []
                for doc_id in top_ids:
                    if 0 <= int(doc_id) < len(documents):
                        reranked.append(documents[int(doc_id)])
                return reranked[:top_k]
        except Exception:
            pass
            
        return documents[:top_k]
