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


class ChatMessageResponse(BaseModel):
    id: str
    session_id: str
    role: str
    message: str
    citations: list[Citation] = Field(default_factory=list)
    created_at: datetime


class ChatSessionDetailResponse(BaseModel):
    session: ChatSessionResponse
    messages: list[ChatMessageResponse]


class TranscriptionResponse(BaseModel):
    text: str
