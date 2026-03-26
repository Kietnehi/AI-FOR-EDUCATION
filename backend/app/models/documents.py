"""MongoDB document contracts for repository layer references.

These TypedDicts are intentionally lightweight and practical for MVP.
"""

from datetime import datetime
from typing import Any, TypedDict


class LearningMaterialDoc(TypedDict, total=False):
    user_id: str
    title: str
    description: str | None
    subject: str | None
    education_level: str | None
    source_type: str
    file_name: str | None
    file_url: str | None
    raw_text: str
    cleaned_text: str
    tags: list[str]
    processing_status: str
    guardrail_status: str | None
    guardrail_category: str | None
    guardrail_reason: str | None
    guardrail_checked_at: datetime
    created_at: datetime
    updated_at: datetime


class GeneratedContentDoc(TypedDict, total=False):
    material_id: str
    content_type: str
    game_type: str
    version: int
    outline: list[str]
    json_content: dict[str, Any]
    file_url: str | None
    generation_status: str
    created_at: datetime
    updated_at: datetime
