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

    redis_url: str = "redis://localhost:6379/0"
    celery_broker_url: str = "redis://localhost:6379/0"
    celery_result_backend: str = "redis://localhost:6379/1"
    celery_result_expires_seconds: int = 86400
    celery_task_soft_time_limit_seconds: int = 1800
    celery_task_time_limit_seconds: int = 2100
    celery_worker_prefetch_multiplier: int = 1

    chroma_persist_dir: str = "./storage/chroma"
    chroma_collection_name: str = "material_chunks"

    google_client_id: str = ""
    google_token_clock_skew_seconds: int = 120
    jwt_secret_key: str = "your-secret-key-change-in-production"
    jwt_algorithm: str = "HS256"
    jwt_expiration_minutes: int = 43200  # 30 days
    auth_cookie_name: str = "ai_learning_auth_token"
    auth_cookie_secure: bool = False

    # Cloudflare Turnstile CAPTCHA
    turnstile_secret_key: str = ""
    smtp_host: str = ""
    smtp_port: int = 465
    smtp_user: str = ""
    smtp_pass: str = ""
    contact_recipient_email: str = ""

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
    tavily_api_key: str = ""
    mascot_chat_model: str = "openai/gpt-4o-mini"
    web_search_refinement_model: str = "openai/gpt-4o-mini"

    whisper_model: str = "base"
    whisper_language: str | None = None

    groq_api_key: str = ""
    groq_base_url: str = "https://api.groq.com"
    
    serpapi_api_key: str = ""
    
    pexels_api_key: str = ""

    ocr_space_api_key: str = ""
    ocr_space_url: str = "https://api.ocr.space/parse/image"
    ocr_space_timeout_seconds: int = 120
    ocr_space_layout_engine: int = 3
    ocr_space_boxes_engine: int = 2

    upload_dir: str = "./storage/uploads"
    generated_dir: str = "./storage/generated"
    image_cache_dir: str = "./storage/images"
    notebooklm_documents_dir: str = "./storage/notebooklm/documents"
    notebooklm_user_data_dir: str = "./storage/notebooklm/chrome-profile"
    notebooklm_generate_wait_seconds: int = 120
    notebooklm_headless: bool = False

    use_object_storage: bool = False
    use_r2: bool = False
    minio_endpoint: str = "http://localhost:9000"
    minio_root_user: str = "minioadmin"
    minio_root_password: str = "minioadmin123"
    minio_bucket: str = "ai-learning-storage"
    r2_endpoint: str = ""
    r2_access_key_id: str = ""
    r2_secret_access_key: str = ""
    r2_bucket: str = ""
    r2_public_base_url: str = ""
    storage_presigned_expiration_seconds: int = 3600

    cors_origins: list[str] = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:3001",
        "http://127.0.0.1:3001",
    ]
    cors_origin_regex: str = r"https?://(localhost|127\.0\.0\.1)(:\d+)?$"

    # Token-based chunking parameters (for text-embedding-3 models)
    chunk_size: int = 2500  # tokens per chunk
    chunk_overlap: int = 500  # tokens overlap
    retrieval_top_k: int = 6
    material_guardrail_excerpt_chars: int = 12000

    # Number of latest chat messages injected as conversation memory for RAG chat.
    chat_memory_turns: int = 8

    # Number of latest mascot chat messages injected as memory.
    mascot_memory_turns: int = 10

    # Personalization telemetry controls
    personalization_event_retention_days: int = 90
    personalization_event_max_string_length: int = 240
    personalization_event_max_metadata_keys: int = 40
    personalization_event_max_list_items: int = 20
    personalization_event_max_depth: int = 3

    # Personalization habit/reminder defaults
    personalization_default_timezone: str = "Asia/Ho_Chi_Minh"
    personalization_default_reminder_hour_local: int = 20
    personalization_weekly_goal_default_active_days: int = 5
    personalization_weekly_goal_default_minutes: int = 180
    personalization_weekly_goal_default_items: int = 6
    personalization_reminder_default_days_of_week: list[int] = [0, 1, 2, 3, 4, 5, 6]
    personalization_reminder_recent_activity_suppression_minutes: int = 120
    personalization_reminder_weekly_cap_active: int = 3
    personalization_reminder_weekly_cap_at_risk: int = 5
    personalization_reminder_weekly_cap_returning: int = 5
    personalization_reminder_weekly_cap_deep_focus: int = 2
    personalization_reminder_transient_retry_attempts: int = 2
    personalization_streak_freeze_per_week: int = 1
    personalization_reminder_lock_ttl_seconds: int = 900

    # Personalization risk detection thresholds
    personalization_risk_inactive_days: int = 3
    personalization_risk_activity_drop_threshold: float = 0.35
    personalization_risk_min_previous_week_events: int = 6

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
        if not self.contact_recipient_email and self.smtp_user:
            self.contact_recipient_email = self.smtp_user
        return self


settings = Settings()
