from datetime import datetime
from pydantic import BaseModel, Field


class ThreadCreate(BaseModel):
    title: str
    description: str | None = None
    material_ids: list[str] = Field(default_factory=list)
    thumbnail_url: str | None = None


class ThreadUpdate(BaseModel):
    title: str | None = None
    description: str | None = None
    material_ids: list[str] | None = None
    thumbnail_url: str | None = None


class ThreadResponse(BaseModel):
    id: str
    title: str
    description: str | None = None
    creator_id: str
    creator_name: str | None = None
    creator_avatar: str | None = None
    material_ids: list[str]
    likes_count: int = 0
    liked_by_user_ids: list[str] = Field(default_factory=list)
    comment_count: int = 0
    thumbnail_url: str | None = None
    first_material_type: str | None = None
    created_at: datetime
    updated_at: datetime


class CommentCreate(BaseModel):
    content: str
    image_url: str | None = None
    reply_to_comment_id: str | None = None


class CommentResponse(BaseModel):
    id: str
    thread_id: str
    user_id: str
    user_name: str | None = None
    user_avatar: str | None = None
    content: str
    image_url: str | None = None
    is_ai_response: bool
    reply_to_comment_id: str | None = None
    likes_count: int = 0
    liked_by_user_ids: list[str] = Field(default_factory=list)
    created_at: datetime


class AskAIRequest(BaseModel):
    question: str
    reply_to_comment_id: str | None = None
