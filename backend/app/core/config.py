from pathlib import Path

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    app_env: str = "development"
    log_level: str = "INFO"

    mongo_uri: str = "mongodb://localhost:27017"
    mongo_db_name: str = "ai_learning_platform"

    chroma_persist_dir: str = "./storage/chroma"
    chroma_collection_name: str = "material_chunks"

    openai_api_key: str = ""
    openai_model: str = "gpt-4o-mini"
    openai_embedding_model: str = "text-embedding-3-small"
    openai_base_url: str | None = None
    openrouter_site_url: str = ""
    openrouter_site_name: str = ""

    llm_provider: str = "gemini"
    gemini_api_key: str = ""
    gemini_model: str = "gemini-3-flash-preview"

    upload_dir: str = "./storage/uploads"
    generated_dir: str = "./storage/generated"

    cors_origins: list[str] = ["http://localhost:3000"]

    chunk_size: int = 900
    chunk_overlap: int = 120
    retrieval_top_k: int = 5

    @field_validator("upload_dir", "generated_dir", "chroma_persist_dir")
    @classmethod
    def ensure_dirs(cls, value: str) -> str:
        Path(value).mkdir(parents=True, exist_ok=True)
        return value


settings = Settings()
