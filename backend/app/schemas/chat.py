from datetime import datetime

from pydantic import BaseModel, Field

from app.schemas.common import Citation


class CreateChatSessionRequest(BaseModel):
    user_id: str = Field(default="demo-user")
    session_title: str | None = None


class ChatSessionResponse(BaseModel):
    id: str
    user_id: str
    material_id: str
    session_title: str
    created_at: datetime
    updated_at: datetime


class ChatMessageRequest(BaseModel):
    message: str
    images: list[str] = Field(default_factory=list, description="Base64 encoded images")


class MascotChatRequest(BaseModel):
    message: str
    session_id: str | None = None
    images: list[str] = Field(default_factory=list, description="Base64 encoded images")


class ChatMessageResponse(BaseModel):
    id: str
    session_id: str
    role: str
    message: str
    citations: list[Citation] = Field(default_factory=list)
    created_at: datetime
    model_used: str | None = Field(
        default=None, description="Model đã sử dụng để tạo response"
    )
    fallback_applied: bool = Field(
        default=False, description="Có phải fallback từ model khác không"
    )


class ChatSessionDetailResponse(BaseModel):
    session: ChatSessionResponse
    messages: list[ChatMessageResponse]


class TranscriptionResponse(BaseModel):
    text: str


class TextToSpeechRequest(BaseModel):
    text: str
    lang: str = "vi"


class MascotChatResponse(BaseModel):
    message: str
    model: str
    session_id: str
    model_used: str | None = None
    fallback_applied: bool = False
