from datetime import datetime
from typing import Any

from pydantic import BaseModel


class GameSubmitRequest(BaseModel):
    answers: list[dict[str, Any]]


class GameAttemptResponse(BaseModel):
    id: str
    user_id: str
    material_id: str
    generated_content_id: str
    game_type: str = "quiz_mixed"
    answers: list[dict[str, Any]]
    score: float
    max_score: float
    feedback: list[dict[str, Any]]
    skills_gained: list[str] = []
    improvement_tips: list[str] = []
    started_at: datetime
    completed_at: datetime
