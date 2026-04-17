from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field


ContentType = Literal["slides", "podcast", "minigame", "chatbot_config", "quiz", "video", "infographic", "knowledge_graph"]
GenerationStatus = Literal["queued", "generating", "generated", "failed"]


class GenerateSlidesRequest(BaseModel):
    tone: str = "teacher"
    max_slides: int = Field(
        default=10,
        ge=3,
        le=50,
        description="Số lượng slide tối đa muốn tạo (3-50 slides)"
    )
    skip_refine: bool = Field(default=False, description="Skip LLM refine step to save cost (may reduce quality)")
    force_regenerate: bool = Field(default=False, description="Bắt buộc tạo mới nội dung")


class GeneratePodcastRequest(BaseModel):
    style: Literal["lecturer", "two_hosts", "quick_summary"] = "lecturer"
    target_duration_minutes: int = Field(default=8, ge=3, le=30)
    force_regenerate: bool = Field(default=False, description="Bắt buộc tạo mới nội dung")


class GenerateMinigameRequest(BaseModel):
    game_type: Literal["quiz_mixed", "flashcard", "scenario_branching"] = "quiz_mixed"
    difficulty: Literal["easy", "medium", "hard"] = "medium"
    force_regenerate: bool = Field(default=False, description="Bắt buộc tạo mới nội dung")


class GenerateKnowledgeGraphRequest(BaseModel):
    force_regenerate: bool = Field(default=False, description="Bắt buộc tạo mới nội dung")



class GenerateNotebookLMMediaRequest(BaseModel):
    prompt: str | None = Field(default=None, min_length=5, max_length=2000)
    guidance: str | None = Field(default=None, max_length=2000)
    confirm: bool = Field(default=False, description="Set to true to start generation. First call with confirm=false to get confirmation prompt.")
    force_regenerate: bool = Field(default=False, description="Bắt buộc tạo mới nội dung")


class NotebookLMMediaFile(BaseModel):
    file_name: str
    file_url: str
    storage_type: str | None = None


class GenerateNotebookLMMediaResponse(BaseModel):
    status: str = "generation_complete"
    session_id: str
    material_id: str | None = None
    prompt: str
    notebook_title: str | None = None
    message: str = "Đã tạo xong! Vui lòng xác nhận để tải xuống."


class NotebookLMArtifactConfirmationResponse(BaseModel):
    """Response after upload, waiting for user confirmation to trigger artifact creation."""
    status: str = "awaiting_artifact_confirmation"
    session_id: str
    material_id: str | None = None
    prompt: str
    notebook_title: str | None = None
    message: str = "Đã upload tài liệu lên NotebookLM. Xác nhận để bấm tạo Video + Infographic."


class ConfirmNotebookLMDownloadResponse(BaseModel):
    """Response after confirming download to permanent storage"""
    status: str = "saved"
    session_id: str
    videos: list[NotebookLMMediaFile] = Field(default_factory=list)
    infographics: list[NotebookLMMediaFile] = Field(default_factory=list)


class NotebookLMConfirmationResponse(BaseModel):
    """Confirmation prompt before starting media generation"""
    status: str = "awaiting_confirmation"
    material_id: str | None = None
    prompt: str
    message: str = "Sẵn sàng tạo video và infographics từ học liệu này. Tác vụ này có thể mất 5-10 phút hoặc lâu hơn. Bạn có chắc chắn muốn tiếp tục? Gửi lại request với confirm=true để xác nhận."
    estimated_duration_seconds: int = Field(default=600, description="Estimated time for generation in seconds")


class GenerationTaskQueuedResponse(BaseModel):
    task_id: str
    status: str = "queued"
    message: str


class GenerationTaskStatusResponse(BaseModel):
    task_id: str
    status: str
    celery_state: str
    progress: int | None = None
    result: dict[str, Any] | None = None
    error: str | None = None


class GeneratedContentResponse(BaseModel):
    model_config = ConfigDict(cache_strings=True)
    
    id: str
    material_id: str
    content_type: ContentType
    game_type: str | None = None
    difficulty: str | None = None
    version: int
    outline: list[str] = Field(default_factory=list)
    json_content: dict[str, Any] = Field(default_factory=dict)
    file_url: str | None = None
    storage_type: str | None = None
    generation_status: GenerationStatus
    model_used: str | None = None
    fallback_applied: bool = False
    created_at: datetime
    updated_at: datetime
