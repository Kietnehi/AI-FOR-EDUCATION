from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field
from app.schemas.auth import AuthUser


SourceType = Literal["pdf", "docx", "txt", "md", "image", "audio", "manual_text"]
ProcessingStatus = Literal["uploaded", "queued", "processing", "processed", "failed"]


class MaterialCreateRequest(BaseModel):
    user_id: str = Field(default="demo-user")
    title: str
    description: str | None = None
    subject: str | None = None
    education_level: str | None = None
    tags: list[str] = Field(default_factory=list)
    source_type: SourceType = "manual_text"
    raw_text: str


class MaterialGuardrailCheckRequest(BaseModel):
    title: str | None = None
    description: str | None = None
    subject: str | None = None
    education_level: str | None = None
    tags: list[str] = Field(default_factory=list)
    source_type: SourceType = "manual_text"
    raw_text: str


class MaterialProcessRequest(BaseModel):
    force_reprocess: bool = False
    chunking_strategy: Literal["semantic", "fixed"] = "fixed"


class MaterialUpdateRequest(BaseModel):
    title: str | None = None
    description: str | None = None
    subject: str | None = None
    education_level: str | None = None
    tags: list[str] | None = None


class MaterialGuardrailCheckResponse(BaseModel):
    is_academic: bool
    category: str
    message: str


class OCRWord(BaseModel):
    text: str
    left: float
    top: float
    width: float
    height: float


class OCRPreviewResponse(BaseModel):
    text: str
    words: list[OCRWord] = Field(default_factory=list)


class MaterialResponse(BaseModel):
    id: str
    user_id: str
    title: str
    description: str | None = None
    subject: str | None = None
    education_level: str | None = None
    source_type: SourceType
    file_name: str | None = None
    file_url: str | None = None
    storage_type: str | None = None
    tags: list[str] = Field(default_factory=list)
    processing_status: ProcessingStatus
    guardrail_status: str | None = None
    guardrail_category: str | None = None
    guardrail_reason: str | None = None
    raw_text: str | None = None
    cleaned_text: str | None = None
    shared_with: list[str] = Field(default_factory=list)
    shared_details: list[AuthUser] = Field(default_factory=list)
    created_at: datetime
    updated_at: datetime


class MaterialShareRequest(BaseModel):
    email: str


class MaterialListResponse(BaseModel):
    items: list[MaterialResponse]
    total: int


class MaterialProcessResponse(BaseModel):
    material_id: str
    processing_status: ProcessingStatus
    message: str
