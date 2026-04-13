from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field


ThemePreference = Literal["light", "dark", "system"]
LearningPace = Literal["light", "moderate", "intensive"]


class CustomModelOption(BaseModel):
    id: str
    name: str


class PersonalizationPreferencesResponse(BaseModel):
    user_id: str
    theme: ThemePreference = "system"
    mascot_enabled: bool = True
    chat_model_id: str = "openai/gpt-4o-mini"
    chat_model_name: str = "GPT-4o Mini"
    chat_model_supports_reasoning: bool = False
    chat_use_gemini_rotation: bool = True
    chat_custom_models: list[CustomModelOption] = Field(default_factory=list)
    preferred_language: str = "vi"
    learning_pace: LearningPace = "moderate"
    study_goal: str | None = None
    created_at: datetime
    updated_at: datetime


class PersonalizationPreferencesUpdateRequest(BaseModel):
    theme: ThemePreference | None = None
    mascot_enabled: bool | None = None
    chat_model_id: str | None = None
    chat_model_name: str | None = None
    chat_model_supports_reasoning: bool | None = None
    chat_use_gemini_rotation: bool | None = None
    chat_custom_models: list[CustomModelOption] | None = None
    preferred_language: str | None = None
    learning_pace: LearningPace | None = None
    study_goal: str | None = None


class ContinueLearningItem(BaseModel):
    material_id: str
    title: str
    subject: str | None = None
    reason: str
    last_activity_at: datetime | None = None
    recommendation_score: float = 0.0


class FeatureAffinityItem(BaseModel):
    feature: str
    score: float
    reason: str


class StudyRhythmSnapshot(BaseModel):
    active_days_7d: int
    events_7d: int
    last_active_at: datetime | None = None
    retention_status: Literal["inactive", "low", "medium", "high"] = "inactive"
    days_since_last_active: int | None = None
    top_feature: str | None = None


class PersonalizationSummary(BaseModel):
    materials_total: int = 0
    generated_total: int = 0
    chat_sessions_total: int = 0
    game_attempts_total: int = 0
    average_game_accuracy: float = 0.0


class DashboardPersonalizationResponse(BaseModel):
    generated_counts: dict[str, int] = Field(default_factory=dict)
    continue_learning: list[ContinueLearningItem] = Field(default_factory=list)
    next_actions: list[str] = Field(default_factory=list)
    feature_affinity: list[FeatureAffinityItem] = Field(default_factory=list)
    study_rhythm: StudyRhythmSnapshot
    summary: PersonalizationSummary
