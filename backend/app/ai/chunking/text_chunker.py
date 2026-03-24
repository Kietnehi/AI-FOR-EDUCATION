from dataclasses import dataclass
import tiktoken


@dataclass
class Chunk:
    chunk_index: int
    chunk_text: str


class TextChunker:
    def __init__(self, chunk_size: int, overlap: int, encoding_name: str = "cl100k_base") -> None:
        """
        Initialize chunker with token-based splitting.

        Args:
            chunk_size: Target size in tokens per chunk
            overlap: Overlap in tokens between consecutive chunks
            encoding_name: Tiktoken encoding name (cl100k_base for text-embedding-3-small/large)
        """
        self.chunk_size = chunk_size
        self.overlap = overlap
        self.encoding_name = encoding_name
        try:
            self.tokenizer = tiktoken.get_encoding(encoding_name)
        except Exception:
            # Fallback to a common encoding if specified one fails
            self.tokenizer = tiktoken.get_encoding("cl100k_base")

    def split(self, text: str) -> list[Chunk]:
        if not text:
            return []

        # Tokenize the entire text
        tokens = self.tokenizer.encode(text)
        total_tokens = len(tokens)

        if total_tokens <= self.chunk_size:
            # Text fits in one chunk
            return [Chunk(chunk_index=0, chunk_text=text.strip())]

        chunks: list[Chunk] = []
        start_token = 0
        index = 0

        while start_token < total_tokens:
            # Calculate end token position
            end_token = min(start_token + self.chunk_size, total_tokens)

            # Extract tokens for this chunk and decode back to text
            chunk_tokens = tokens[start_token:end_token]
            chunk_text = self.tokenizer.decode(chunk_tokens).strip()

            if chunk_text:
                chunks.append(Chunk(chunk_index=index, chunk_text=chunk_text))
                index += 1

            if end_token == total_tokens:
                break

            # Move start position with overlap
            start_token = max(end_token - self.overlap, start_token + 1)

        return chunks
