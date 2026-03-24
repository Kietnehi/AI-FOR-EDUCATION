from datetime import datetime
from typing import Any

from pydantic import BaseModel


class GameSubmitRequest(BaseModel):
    user_id: str = "demo-user"
    answers: list[dict[str, Any]]


class GameAttemptResponse(BaseModel):
    id: str
    user_id: str
    material_id: str
    generated_content_id: str
    answers: list[dict[str, Any]]
    score: float
    max_score: float
    feedback: list[dict[str, Any]]
    started_at: datetime
    completed_at: datetime
