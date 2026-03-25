from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, Field


ContentType = Literal["slides", "podcast", "minigame", "chatbot_config", "quiz"]
GenerationStatus = Literal["queued", "generating", "generated", "failed"]


class GenerateSlidesRequest(BaseModel):
    tone: str = "teacher"
    max_slides: int = Field(default=8, ge=4, le=20)


class GeneratePodcastRequest(BaseModel):
    style: Literal["lecturer", "two_hosts", "quick_summary"] = "lecturer"
    target_duration_minutes: int = Field(default=8, ge=3, le=30)


class GenerateMinigameRequest(BaseModel):
    game_types: list[Literal["mcq", "fill_blank", "matching", "flashcard"]] = Field(
        default_factory=lambda: ["mcq", "fill_blank", "matching", "flashcard"]
    )


class GenerateNotebookLMMediaRequest(BaseModel):
    prompt: str | None = Field(default=None, min_length=5, max_length=2000)
    guidance: str | None = Field(default=None, max_length=2000)
    confirm: bool = Field(default=False, description="Set to true to start generation. First call with confirm=false to get confirmation prompt.")


class NotebookLMMediaFile(BaseModel):
    file_name: str
    file_url: str


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


class GeneratedContentResponse(BaseModel):
    id: str
    material_id: str
    content_type: ContentType
    version: int
    outline: list[str] = Field(default_factory=list)
    json_content: dict[str, Any] = Field(default_factory=dict)
    file_url: str | None = None
    generation_status: GenerationStatus
    model_used: str | None = None
    fallback_applied: bool = False
    created_at: datetime
    updated_at: datetime
