from rank_bm25 import BM25Okapi
import re
from typing import List, Dict

class BM25Retriever:
    def __init__(self, corpus_chunks: List[Dict]):
        """
        Initialize BM25 with chunks from MongoDB.
        corpus_chunks: List of dictionaries with 'chunk_text' and 'chunk_index'.
        """
        self.chunks = corpus_chunks
        self.texts = [c['chunk_text'] for c in corpus_chunks]
        self.tokenized_corpus = [self._tokenize(text) for text in self.texts]
        self.bm25 = BM25Okapi(self.tokenized_corpus)

    def _tokenize(self, text: str) -> List[str]:
        # Simple tokenization: lowercase and remove non-alphanumeric
        return re.findall(r'\w+', text.lower())

    def retrieve(self, query: str, top_k: int = 10) -> List[Dict]:
        tokenized_query = self._tokenize(query)
        scores = self.bm25.get_scores(tokenized_query)
        
        # Get top indices
        top_indices = sorted(range(len(scores)), key=lambda i: scores[i], reverse=True)[:top_k]
        
        results = []
        for i in top_indices:
            if scores[i] <= 0:
                continue
            chunk = self.chunks[i]
            results.append({
                "chunk_id": chunk.get("chroma_id") or chunk.get("id") or str(chunk.get("_id")),
                "chunk_text": chunk['chunk_text'],
                "chunk_index": chunk['chunk_index'],
                "material_id": chunk['material_id'],
                "score": float(scores[i])
            })
        return results
