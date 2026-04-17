import hashlib

from openai import OpenAI

from app.core.config import settings
from app.core.logging import logger


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
            try:
                response = self.client.embeddings.create(**request_kwargs)
                data = getattr(response, "data", None)
                if not data:
                    raise ValueError("empty embedding response data")

                embeddings = [getattr(item, "embedding", None) for item in data]
                if len(embeddings) != len(texts) or any(e is None for e in embeddings):
                    raise ValueError("embedding response shape mismatch")
                return embeddings
            except Exception as exc:  # noqa: BLE001
                logger.exception(
                    "Embedding API failed for model %s (base_url=%s). Using deterministic fallback. Error: %s",
                    self.model,
                    self.base_url,
                    exc,
                )
                return [self._fallback_embedding(text) for text in texts]

        # Deterministic fallback embedding for local testing without OpenAI key.
        return [self._fallback_embedding(text) for text in texts]

    @staticmethod
    def _fallback_embedding(text: str, dim: int = 128) -> list[float]:
        digest = hashlib.sha256(text.encode("utf-8", errors="ignore")).digest()
        values = list(digest) * ((dim // len(digest)) + 1)
        return [float(v) / 255.0 for v in values[:dim]]
