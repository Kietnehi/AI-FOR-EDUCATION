from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field


class APIResponse(BaseModel):
    success: bool = True
    message: str = "ok"
    data: Any | None = None


class TimestampedModel(BaseModel):
    created_at: datetime
    updated_at: datetime | None = None


class Citation(BaseModel):
    material_id: str
    chunk_id: str
    chunk_index: int
    snippet: str


class PaginationQuery(BaseModel):
    skip: int = Field(default=0, ge=0)
    limit: int = Field(default=20, ge=1, le=100)
