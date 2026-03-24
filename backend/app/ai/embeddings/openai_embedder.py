import hashlib

from openai import OpenAI

from app.core.config import settings


class OpenAIEmbedder:
    def __init__(self) -> None:
        self.api_key = settings.openai_api_key
        self.model = settings.openai_embedding_model
        self.base_url = settings.openai_base_url
        self.client = OpenAI(api_key=self.api_key, base_url=self.base_url) if self.api_key else None

        self.extra_headers: dict[str, str] = {}
        if settings.openrouter_site_url:
            self.extra_headers["HTTP-Referer"] = settings.openrouter_site_url
        if settings.openrouter_site_name:
            self.extra_headers["X-OpenRouter-Title"] = settings.openrouter_site_name

    def embed_texts(self, texts: list[str]) -> list[list[float]]:
        if not texts:
            return []
        if self.client:
            request_kwargs = {
                "model": self.model,
                "input": texts,
                "encoding_format": "float",
            }
            if self.extra_headers:
                request_kwargs["extra_headers"] = self.extra_headers
            response = self.client.embeddings.create(**request_kwargs)
            return [item.embedding for item in response.data]

        # Deterministic fallback embedding for local testing without OpenAI key.
        return [self._fallback_embedding(text) for text in texts]

    @staticmethod
    def _fallback_embedding(text: str, dim: int = 128) -> list[float]:
        digest = hashlib.sha256(text.encode("utf-8", errors="ignore")).digest()
        values = list(digest) * ((dim // len(digest)) + 1)
        return [float(v) / 255.0 for v in values[:dim]]
