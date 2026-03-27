from pathlib import Path

from pydantic import field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env", env_file_encoding="utf-8", extra="ignore"
    )

    app_env: str = "development"
    log_level: str = "INFO"

    mongo_uri: str = "mongodb://localhost:27017"
    mongo_db_name: str = "ai_learning_platform"

    chroma_persist_dir: str = "./storage/chroma"
    chroma_collection_name: str = "material_chunks"

    openai_api_key: str = ""
    openai_model: str = "gpt-4o-mini"
    openai_guardrail_model: str = "gpt-4o-mini"
    openai_embedding_model: str = "text-embedding-3-small"
    openai_base_url: str | None = None
    openrouter_site_url: str = ""
    openrouter_site_name: str = ""

    llm_provider: str = "gemini"
    gemini_api_key: str = ""  # Legacy single key (backward compatibility)
    gemini_api_keys: list[str] = []  # Multiple API keys for rotation
    gemini_model: str = "gemini-3-flash-preview"
    mascot_chat_model: str = "openai/gpt-4o-mini"

    whisper_model: str = "base"
    whisper_language: str | None = None

    groq_api_key: str = ""
    groq_base_url: str = "https://api.groq.com"

    upload_dir: str = "./storage/uploads"
    generated_dir: str = "./storage/generated"
    image_cache_dir: str = "./storage/images"
    notebooklm_documents_dir: str = "./storage/notebooklm/documents"
    notebooklm_user_data_dir: str = "./storage/notebooklm/chrome-profile"
    notebooklm_generate_wait_seconds: int = 120
    notebooklm_headless: bool = False

    cors_origins: list[str] = ["http://localhost:3000"]

    # Token-based chunking parameters (for text-embedding-3 models)
    chunk_size: int = 2500  # tokens per chunk
    chunk_overlap: int = 500  # tokens overlap
    retrieval_top_k: int = 6
    material_guardrail_excerpt_chars: int = 12000

    # Number of latest chat messages injected as conversation memory for RAG chat.
    chat_memory_turns: int = 8

    # Number of latest mascot chat messages injected as memory.
    mascot_memory_turns: int = 10

    @field_validator(
        "upload_dir",
        "generated_dir",
        "chroma_persist_dir",
        "notebooklm_documents_dir",
        "notebooklm_user_data_dir",
    )
    @classmethod
    def ensure_dirs(cls, value: str) -> str:
        Path(value).mkdir(parents=True, exist_ok=True)
        return value

    @model_validator(mode="after")
    def setup_gemini_keys(self) -> "Settings":
        # Backward compatibility: if gemini_api_key is set but gemini_api_keys is empty,
        # use the single key as the only item in the list
        if self.gemini_api_key and not self.gemini_api_keys:
            self.gemini_api_keys = [self.gemini_api_key]
        # Ensure gemini_api_key reflects the first key for backward compatibility
        if self.gemini_api_keys:
            self.gemini_api_key = self.gemini_api_keys[0]
        return self


settings = Settings()
