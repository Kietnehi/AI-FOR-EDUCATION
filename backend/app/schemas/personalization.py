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
    reminder_timezone: str = "Asia/Ho_Chi_Minh"
    reminder_hour_local: int = 20
    reminder_days_of_week: list[int] = Field(default_factory=lambda: [0, 1, 2, 3, 4, 5, 6])
    reminder_in_app_enabled: bool = True
    reminder_email_enabled: bool = True
    weekly_goal_active_days: int = 5
    weekly_goal_minutes: int = 180
    weekly_goal_items: int = 6
    streak_current_days: int = 0
    streak_longest_days: int = 0
    streak_last_checkin_date: str | None = None
    streak_total_checkins: int = 0
    streak_freeze_used_week: int = 0
    streak_freeze_week_start: str | None = None
    sidebar_order: list[str] = Field(default_factory=list)
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
    reminder_timezone: str | None = None
    reminder_hour_local: int | None = Field(default=None, ge=0, le=23)
    reminder_days_of_week: list[int] | None = None
    reminder_in_app_enabled: bool | None = None
    reminder_email_enabled: bool | None = None
    weekly_goal_active_days: int | None = Field(default=None, ge=1, le=7)
    weekly_goal_minutes: int | None = Field(default=None, ge=30, le=3000)
    weekly_goal_items: int | None = Field(default=None, ge=1, le=200)
    sidebar_order: list[str] | None = None


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


class WeeklyGoalProgress(BaseModel):
    active_days: int = 0
    active_days_goal: int = 5
    minutes: int = 0
    minutes_goal: int = 180
    completed_items: int = 0
    completed_items_goal: int = 6
    completion_rate: float = 0.0


class HabitOverview(BaseModel):
    checkin_today: bool = False
    current_streak_days: int = 0
    longest_streak_days: int = 0
    last_checkin_date: str | None = None
    days_since_last_checkin: int | None = None
    freeze_used_this_week: int = 0
    freeze_remaining_this_week: int = 1
    week_start: str | None = None
    weekly_goal: WeeklyGoalProgress


class ReminderItem(BaseModel):
    channel: Literal["in_app", "email"]
    title: str
    message: str
    due_now: bool = False


class LearningRiskAlert(BaseModel):
    status: Literal["stable", "warning", "high_risk"] = "stable"
    reasons: list[str] = Field(default_factory=list)
    suggested_actions: list[str] = Field(default_factory=list)


class DashboardPersonalizationResponse(BaseModel):
    generated_counts: dict[str, int] = Field(default_factory=dict)
    continue_learning: list[ContinueLearningItem] = Field(default_factory=list)
    next_actions: list[str] = Field(default_factory=list)
    feature_affinity: list[FeatureAffinityItem] = Field(default_factory=list)
    study_rhythm: StudyRhythmSnapshot
    habit_overview: HabitOverview
    reminders: list[ReminderItem] = Field(default_factory=list)
    risk_alert: LearningRiskAlert
    summary: PersonalizationSummary


class CheckInRequest(BaseModel):
    use_streak_freeze: bool = False


class CheckInResponse(BaseModel):
    checked_in: bool
    already_checked_in_today: bool = False
    used_streak_freeze: bool = False
    message: str
    habit_overview: HabitOverview


class ReminderDispatchRequest(BaseModel):
    force: bool = True


class ReminderDispatchResponse(BaseModel):
    sent: bool
    channel: Literal["email"] = "email"
    message: str
    sent_at: datetime | None = None
