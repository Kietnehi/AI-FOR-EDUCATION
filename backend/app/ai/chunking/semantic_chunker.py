import nltk
from dataclasses import dataclass
from typing import List
import numpy as np

# Download NLTK data if not present
try:
    nltk.data.find('tokenizers/punkt')
except LookupError:
    nltk.download('punkt')

@dataclass
class Chunk:
    chunk_index: int
    chunk_text: str

class SemanticChunker:
    def __init__(self, embedder, threshold: float = 0.8, min_chunk_size: int = 100, max_chunk_size: int = 2000):
        """
        Initialize the semantic chunker.
        """
        self.embedder = embedder
        self.threshold = threshold
        self.min_chunk_size = min_chunk_size
        self.max_chunk_size = max_chunk_size

    def split_sentences(self, text: str) -> List[str]:
        # Use NLTK for high-quality sentence splitting
        return nltk.sent_tokenize(text)

    def cosine_similarity(self, a, b):
        return np.dot(a, b) / (np.linalg.norm(a) * np.linalg.norm(b))

    def split(self, text: str) -> List[Chunk]:
        if not text:
            return []

        sentences = self.split_sentences(text)
        if not sentences:
            return []

        # Embed all sentences at once for efficiency
        sentence_embeddings = self.embedder.embed_texts(sentences)
        
        chunks: List[Chunk] = []
        current_chunk_sentences = [sentences[0]]
        current_chunk_embedding = sentence_embeddings[0]
        
        chunk_idx = 0
        
        for i in range(1, len(sentences)):
            sentence = sentences[i]
            embedding = sentence_embeddings[i]
            
            similarity = self.cosine_similarity(current_chunk_embedding, embedding)
            
            chunk_length = sum(len(s) for s in current_chunk_sentences)
            
            # Split if similarity is low AND current chunk is large enough
            # OR if adding this sentence makes it too large
            should_split = (similarity < self.threshold and chunk_length >= self.min_chunk_size) or \
                           (chunk_length + len(sentence) > self.max_chunk_size)
            
            if should_split:
                chunks.append(Chunk(chunk_index=chunk_idx, chunk_text=" ".join(current_chunk_sentences)))
                chunk_idx += 1
                current_chunk_sentences = [sentence]
                current_chunk_embedding = embedding
            else:
                current_chunk_sentences.append(sentence)
                # Update current chunk embedding (running average)
                current_chunk_embedding = (current_chunk_embedding * (len(current_chunk_sentences) - 1) + embedding) / len(current_chunk_sentences)

        if current_chunk_sentences:
            chunks.append(Chunk(chunk_index=chunk_idx, chunk_text=" ".join(current_chunk_sentences)))
            
        return chunks
