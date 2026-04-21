from datetime import datetime
from typing import TypedDict


class CommunityThreadDoc(TypedDict, total=False):
    id: str
    title: str
    description: str | None
    creator_id: str
    creator_name: str | None
    creator_avatar: str | None
    material_ids: list[str]
    likes_count: int
    liked_by_user_ids: list[str]
    comment_count: int
    thumbnail_url: str | None  # Custom cover
    created_at: datetime
    updated_at: datetime


class ThreadCommentDoc(TypedDict, total=False):
    id: str
    thread_id: str
    user_id: str
    user_name: str | None
    user_avatar: str | None
    content: str
    image_url: str | None  # New: Attachment image
    is_ai_response: bool
    reply_to_comment_id: str | None
    likes_count: int
    liked_by_user_ids: list[str]
    created_at: datetime
