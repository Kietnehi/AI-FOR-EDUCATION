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
