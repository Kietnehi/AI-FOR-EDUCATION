from __future__ import annotations

from datetime import datetime, timedelta, timezone

import pytest

import app.services.personalization_service as personalization_module
from app.services.personalization_service import PersonalizationService


class FakeCursor:
    def __init__(self, rows: list[dict]) -> None:
        self._rows = list(rows)
        self._limit: int | None = None

    def sort(self, key: str, direction: int):
        reverse = direction == -1

        def sort_key(item: dict):
            value = item.get(key)
            if value is None:
                return datetime.min.replace(tzinfo=timezone.utc)
            return value

        self._rows = sorted(self._rows, key=sort_key, reverse=reverse)
        return self

    def limit(self, limit: int):
        self._limit = limit
        return self

    async def to_list(self, length: int):
        effective_limit = self._limit if self._limit is not None else length
        return self._rows[: min(length, effective_limit)]


class FakeCollection:
    def __init__(self, rows: list[dict]) -> None:
        self._rows = list(rows)

    @staticmethod
    def _matches(row: dict, query: dict) -> bool:
        for key, expected in query.items():
            value = row.get(key)
            if isinstance(expected, dict):
                if value is None:
                    return False
                if "$gte" in expected and value < expected["$gte"]:
                    return False
                if "$gt" in expected and value <= expected["$gt"]:
                    return False
                if "$lte" in expected and value > expected["$lte"]:
                    return False
                if "$lt" in expected and value >= expected["$lt"]:
                    return False
                continue
            if value != expected:
                return False
        return True

    @staticmethod
    def _apply_projection(row: dict, projection: dict | None) -> dict:
        if not projection:
            return dict(row)
        included = {key for key, enabled in projection.items() if enabled}
        if not included:
            return dict(row)
        return {key: row[key] for key in included if key in row}

    def find(self, query: dict | None = None, projection: dict | None = None):
        query = query or {}
        filtered = [
            self._apply_projection(row, projection)
            for row in self._rows
            if self._matches(row, query)
        ]
        return FakeCursor(filtered)


class FakeDB:
    def __init__(self, *, analytics_events: list[dict]) -> None:
        self.analytics_events = FakeCollection(analytics_events)


class FakePreferencesRepo:
    def __init__(self, payload: dict) -> None:
        self.payload = dict(payload)

    async def get_or_create_by_user_id(self, user_id: str) -> dict:
        return {"user_id": user_id, **self.payload}

    async def upsert_by_user_id(self, user_id: str, payload: dict) -> dict:
        self.payload.update(payload)
        return {"user_id": user_id, **self.payload}


@pytest.mark.asyncio
async def test_reminder_skip_when_today_not_in_selected_days(monkeypatch: pytest.MonkeyPatch) -> None:
    now = datetime(2026, 4, 14, 14, 0, tzinfo=timezone.utc)  # Tue local (UTC+7)
    monkeypatch.setattr(personalization_module, "utc_now", lambda: now)

    monkeypatch.setattr(personalization_module.settings, "smtp_host", "smtp.test")
    monkeypatch.setattr(personalization_module.settings, "smtp_user", "noreply@test")
    monkeypatch.setattr(personalization_module.settings, "smtp_pass", "secret")

    service = PersonalizationService(FakeDB(analytics_events=[]))
    service.preferences_repo = FakePreferencesRepo(
        {
            "reminder_timezone": "Asia/Ho_Chi_Minh",
            "reminder_hour_local": 20,
            "reminder_days_of_week": [0],
            "reminder_email_enabled": True,
            "streak_last_checkin_date": None,
            "reminder_last_email_sent_date": None,
        }
    )

    result = await service.send_learning_reminder_email(
        user_id="u1",
        recipient_email="learner@test",
        recipient_name="Learner",
        force=False,
    )

    assert result["sent"] is False
    assert result.get("reason_code") == "day_not_selected"


@pytest.mark.asyncio
async def test_reminder_skip_when_recent_activity_detected(monkeypatch: pytest.MonkeyPatch) -> None:
    now = datetime(2026, 4, 14, 14, 0, tzinfo=timezone.utc)
    monkeypatch.setattr(personalization_module, "utc_now", lambda: now)

    monkeypatch.setattr(personalization_module.settings, "smtp_host", "smtp.test")
    monkeypatch.setattr(personalization_module.settings, "smtp_user", "noreply@test")
    monkeypatch.setattr(personalization_module.settings, "smtp_pass", "secret")
    monkeypatch.setattr(personalization_module.settings, "personalization_reminder_recent_activity_suppression_minutes", 120)

    events = [
        {
            "user_id": "u1",
            "event_type": "chat_message_sent",
            "created_at": now - timedelta(minutes=30),
        }
    ]

    service = PersonalizationService(FakeDB(analytics_events=events))
    service.preferences_repo = FakePreferencesRepo(
        {
            "reminder_timezone": "Asia/Ho_Chi_Minh",
            "reminder_hour_local": 20,
            "reminder_days_of_week": [0, 1, 2, 3, 4, 5, 6],
            "reminder_email_enabled": True,
            "streak_last_checkin_date": None,
            "reminder_last_email_sent_date": None,
        }
    )

    result = await service.send_learning_reminder_email(
        user_id="u1",
        recipient_email="learner@test",
        recipient_name="Learner",
        force=False,
    )

    assert result["sent"] is False
    assert result.get("reason_code") == "recent_activity"


@pytest.mark.asyncio
async def test_reminder_skip_when_weekly_cap_reached(monkeypatch: pytest.MonkeyPatch) -> None:
    now = datetime(2026, 4, 14, 14, 0, tzinfo=timezone.utc)
    monkeypatch.setattr(personalization_module, "utc_now", lambda: now)

    monkeypatch.setattr(personalization_module.settings, "smtp_host", "smtp.test")
    monkeypatch.setattr(personalization_module.settings, "smtp_user", "noreply@test")
    monkeypatch.setattr(personalization_module.settings, "smtp_pass", "secret")
    monkeypatch.setattr(personalization_module.settings, "personalization_reminder_weekly_cap_active", 2)

    sent_events = [
        {
            "user_id": "u1",
            "event_type": "personalization_email_reminder_sent",
            "created_at": now - timedelta(hours=10),
            "metadata": {"template_id": "progress_focus"},
        },
        {
            "user_id": "u1",
            "event_type": "personalization_email_reminder_sent",
            "created_at": now - timedelta(hours=6),
            "metadata": {"template_id": "maintenance"},
        },
    ]

    service = PersonalizationService(FakeDB(analytics_events=sent_events))
    service.preferences_repo = FakePreferencesRepo(
        {
            "learning_pace": "moderate",
            "reminder_timezone": "Asia/Ho_Chi_Minh",
            "reminder_hour_local": 20,
            "reminder_days_of_week": [0, 1, 2, 3, 4, 5, 6],
            "reminder_email_enabled": True,
            "streak_last_checkin_date": None,
            "reminder_last_email_sent_date": None,
        }
    )

    async def fake_dashboard(_: str) -> dict:
        return {
            "risk_alert": {"status": "stable", "reasons": [], "suggested_actions": []},
            "study_rhythm": {"days_since_last_active": 0},
            "habit_overview": {"weekly_goal": {"completion_rate": 50}, "current_streak_days": 2},
            "next_actions": ["Ôn tập 10 phút"],
        }

    monkeypatch.setattr(service, "build_dashboard_personalization", fake_dashboard)

    result = await service.send_learning_reminder_email(
        user_id="u1",
        recipient_email="learner@test",
        recipient_name="Learner",
        force=False,
    )

    assert result["sent"] is False
    assert result.get("reason_code") == "weekly_cap_reached"
