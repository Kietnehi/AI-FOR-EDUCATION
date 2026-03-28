from app.ai.chunking.text_chunker import Chunk, TextChunker, _TOKENIZER_CACHE


class FakeTokenizer:
    def encode(self, text: str) -> list[str]:
        return text.split()

    def decode(self, tokens: list[str]) -> str:
        return " ".join(tokens)


def test_split_returns_single_chunk_when_text_fits(monkeypatch) -> None:
    monkeypatch.setattr(
        "app.ai.chunking.text_chunker.tiktoken.get_encoding", lambda _: FakeTokenizer()
    )
    _TOKENIZER_CACHE.clear()
    chunker = TextChunker(chunk_size=10, overlap=2, encoding_name="fake")

    chunks = chunker.split("mot hai ba")

    assert chunks == [Chunk(chunk_index=0, chunk_text="mot hai ba")]


def test_split_creates_overlapping_chunks(monkeypatch) -> None:
    monkeypatch.setattr(
        "app.ai.chunking.text_chunker.tiktoken.get_encoding", lambda _: FakeTokenizer()
    )
    _TOKENIZER_CACHE.clear()
    chunker = TextChunker(chunk_size=3, overlap=1, encoding_name="fake")

    chunks = chunker.split("mot hai ba bon nam sau")

    assert [chunk.chunk_index for chunk in chunks] == [0, 1, 2]
    assert [chunk.chunk_text for chunk in chunks] == [
        "mot hai ba",
        "ba bon nam",
        "nam sau",
    ]


def test_chunker_falls_back_to_default_encoding(monkeypatch) -> None:
    fake_tokenizer = FakeTokenizer()

    def fake_get_encoding(name: str):
        if name == "broken":
            raise RuntimeError("unsupported")
        return fake_tokenizer

    monkeypatch.setattr(
        "app.ai.chunking.text_chunker.tiktoken.get_encoding", fake_get_encoding
    )
    _TOKENIZER_CACHE.clear()

    chunker = TextChunker(chunk_size=2, overlap=0, encoding_name="broken")

    assert chunker.tokenizer is fake_tokenizer
    assert chunker.split("") == []
