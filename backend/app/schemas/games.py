from datetime import datetime
from typing import Any, Literal

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


class DifficultyPersonalizationStat(BaseModel):
    difficulty: Literal["easy", "medium", "hard"]
    attempts: int
    average_accuracy: float


class MinigamePersonalizationResponse(BaseModel):
    material_id: str
    total_attempts: int = 0
    average_accuracy: float = 0.0
    suggested_game_type: str = "quiz_mixed"
    recommended_difficulty: str = "medium"
    streak_days: int = 0
    game_type_stats: list[GameTypePersonalizationStat] = Field(default_factory=list)
    difficulty_stats: list[DifficultyPersonalizationStat] = Field(default_factory=list)
    weak_points: list[str] = Field(default_factory=list)
    next_actions: list[str] = Field(default_factory=list)
    is_first_time_user: bool = False
    auto_assigned_difficulty: Literal["easy", "medium", "hard"] | None = None
    first_time_level_plan: list[Literal["easy", "medium", "hard"]] = Field(default_factory=list)
    first_time_allocation_reason: str | None = None
    has_tried_all_difficulties: bool = False
    knowledge_notes: dict[str, str] = Field(default_factory=dict)


class RemediationQuickStartRequest(BaseModel):
    difficulty: Literal["easy", "medium", "hard"] | None = None
    top_k_wrong_questions: int = Field(default=10, ge=3, le=20)


class RemediationQuickStartItem(BaseModel):
    game_type: Literal["quiz_mixed"]
    generated_content_id: str
    difficulty: Literal["easy", "medium", "hard"]
    title: str


class RemediationWrongQuestion(BaseModel):
    question: str
    wrong_count: int
    correct_answer: str | None = None


class RemediationQuickStartResponse(BaseModel):
    material_id: str
    weak_points: list[str] = Field(default_factory=list)
    top_wrong_questions: list[RemediationWrongQuestion] = Field(default_factory=list)
    recommended_difficulty: Literal["easy", "medium", "hard"] = "medium"
    generated_items: list[RemediationQuickStartItem] = Field(default_factory=list)
    message: str
