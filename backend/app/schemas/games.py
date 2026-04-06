from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field


class GameSubmitRequest(BaseModel):
    answers: list[dict[str, Any]]


class GameAttemptResponse(BaseModel):
    id: str
    user_id: str
    material_id: str
    generated_content_id: str
    game_type: str = "quiz_mixed"
    difficulty: str = "medium"
    answers: list[dict[str, Any]]
    score: float
    max_score: float
    feedback: list[dict[str, Any]]
    skills_gained: list[str] = Field(default_factory=list)
    improvement_tips: list[str] = Field(default_factory=list)
    started_at: datetime
    completed_at: datetime


class GameTypePersonalizationStat(BaseModel):
    game_type: str
    attempts: int
    average_accuracy: float
    recommended_difficulty: str
    last_played_difficulty: str


class MinigamePersonalizationResponse(BaseModel):
    material_id: str
    total_attempts: int = 0
    average_accuracy: float = 0.0
    suggested_game_type: str = "quiz_mixed"
    recommended_difficulty: str = "medium"
    streak_days: int = 0
    game_type_stats: list[GameTypePersonalizationStat] = Field(default_factory=list)
    weak_points: list[str] = Field(default_factory=list)
    next_actions: list[str] = Field(default_factory=list)
