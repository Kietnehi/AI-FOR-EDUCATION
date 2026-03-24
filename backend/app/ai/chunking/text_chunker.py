from dataclasses import dataclass


@dataclass
class Chunk:
    chunk_index: int
    chunk_text: str


class TextChunker:
    def __init__(self, chunk_size: int, overlap: int) -> None:
        self.chunk_size = chunk_size
        self.overlap = overlap

    def split(self, text: str) -> list[Chunk]:
        if not text:
            return []

        chunks: list[Chunk] = []
        start = 0
        index = 0
        text_length = len(text)

        while start < text_length:
            end = min(start + self.chunk_size, text_length)
            chunk_text = text[start:end].strip()
            if chunk_text:
                chunks.append(Chunk(chunk_index=index, chunk_text=chunk_text))
                index += 1
            if end == text_length:
                break
            start = max(end - self.overlap, start + 1)

        return chunks
