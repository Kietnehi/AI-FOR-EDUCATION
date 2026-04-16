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
    def __init__(
        self,
        *,
        materials: list[dict],
        generated_contents: list[dict],
        chat_sessions: list[dict],
        game_attempts: list[dict],
        analytics_events: list[dict],
    ) -> None:
        self.learning_materials = FakeCollection(materials)
        self.generated_contents = FakeCollection(generated_contents)
        self.chatbot_sessions = FakeCollection(chat_sessions)
        self.game_attempts = FakeCollection(game_attempts)
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
async def test_dashboard_ranking_boosts_study_goal_match(monkeypatch: pytest.MonkeyPatch) -> None:
    now = datetime(2026, 4, 14, 12, 0, tzinfo=timezone.utc)
    monkeypatch.setattr(personalization_module, "utc_now", lambda: now)

    db = FakeDB(
        materials=[
            {
                "_id": "m1",
                "user_id": "u1",
                "title": "Xac suat co ban",
                "subject": "Toan",
                "description": "Noi dung ve xac suat",
                "tags": ["toan", "xac_suat"],
                "updated_at": now - timedelta(days=2),
            },
            {
                "_id": "m2",
                "user_id": "u1",
                "title": "Lich su Viet Nam",
                "subject": "Lich su",
                "description": "Tong hop su kien",
                "tags": ["lich_su"],
                "updated_at": now,
            },
        ],
        generated_contents=[],
        chat_sessions=[],
        game_attempts=[],
        analytics_events=[],
    )

    service = PersonalizationService(db)
    service.preferences_repo = FakePreferencesRepo(
        {
            "learning_pace": "moderate",
            "study_goal": "Luyen xac suat va xac_suat nang cao",
        }
    )

    payload = await service.build_dashboard_personalization("u1")

    assert payload["continue_learning"][0]["material_id"] == "m1"


@pytest.mark.asyncio
async def test_dashboard_ranking_prioritizes_declining_performance(monkeypatch: pytest.MonkeyPatch) -> None:
    now = datetime(2026, 4, 14, 12, 0, tzinfo=timezone.utc)
    monkeypatch.setattr(personalization_module, "utc_now", lambda: now)

    attempts = [
        {
            "user_id": "u1",
            "material_id": "m1",
            "score": 2,
            "max_score": 10,
            "completed_at": now - timedelta(days=1),
        },
        {
            "user_id": "u1",
            "material_id": "m1",
            "score": 3,
            "max_score": 10,
            "completed_at": now - timedelta(days=2),
        },
        {
            "user_id": "u1",
            "material_id": "m1",
            "score": 8,
            "max_score": 10,
            "completed_at": now - timedelta(days=4),
        },
        {
            "user_id": "u1",
            "material_id": "m2",
            "score": 9,
            "max_score": 10,
            "completed_at": now - timedelta(days=1),
        },
        {
            "user_id": "u1",
            "material_id": "m2",
            "score": 9,
            "max_score": 10,
            "completed_at": now - timedelta(days=2),
        },
        {
            "user_id": "u1",
            "material_id": "m2",
            "score": 8,
            "max_score": 10,
            "completed_at": now - timedelta(days=4),
        },
    ]

    db = FakeDB(
        materials=[
            {
                "_id": "m1",
                "user_id": "u1",
                "title": "Dai so co ban",
                "subject": "Toan",
                "description": "Bai tap dai so",
                "tags": [],
                "updated_at": now - timedelta(days=1),
            },
            {
                "_id": "m2",
                "user_id": "u1",
                "title": "Sinh hoc co ban",
                "subject": "Sinh",
                "description": "Tong quan sinh hoc",
                "tags": [],
                "updated_at": now - timedelta(days=1),
            },
        ],
        generated_contents=[],
        chat_sessions=[],
        game_attempts=attempts,
        analytics_events=[],
    )

    service = PersonalizationService(db)
    service.preferences_repo = FakePreferencesRepo(
        {
            "learning_pace": "intensive",
            "study_goal": None,
        }
    )

    payload = await service.build_dashboard_personalization("u1")

    top_material = payload["continue_learning"][0]
    assert top_material["material_id"] == "m1"
    assert top_material["recommendation_score"] >= payload["continue_learning"][1]["recommendation_score"]


@pytest.mark.asyncio
async def test_dashboard_aggregation_populates_study_rhythm_and_top_feature(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    now = datetime(2026, 4, 14, 12, 0, tzinfo=timezone.utc)
    monkeypatch.setattr(personalization_module, "utc_now", lambda: now)

    events = [
        {
            "user_id": "u1",
            "event_type": "chat_message_sent",
            "created_at": now - timedelta(days=1),
        },
        {
            "user_id": "u1",
            "event_type": "chat_message_stream_requested",
            "created_at": now - timedelta(days=1, hours=1),
        },
        {
            "user_id": "u1",
            "event_type": "generation_requested",
            "created_at": now - timedelta(days=2),
        },
    ]

    db = FakeDB(
        materials=[
            {
                "_id": "m1",
                "user_id": "u1",
                "title": "Vat ly",
                "subject": "Vat ly",
                "description": "",
                "tags": [],
                "updated_at": now - timedelta(days=1),
            }
        ],
        generated_contents=[],
        chat_sessions=[
            {
                "user_id": "u1",
                "material_id": "m1",
                "updated_at": now - timedelta(days=1),
            }
        ],
        game_attempts=[],
        analytics_events=events,
    )

    service = PersonalizationService(db)
    service.preferences_repo = FakePreferencesRepo(
        {
            "learning_pace": "moderate",
            "study_goal": "Vat ly",
        }
    )

    payload = await service.build_dashboard_personalization("u1")

    assert payload["study_rhythm"]["active_days_7d"] == 2
    assert payload["study_rhythm"]["days_since_last_active"] == 1
    assert payload["study_rhythm"]["top_feature"] == "chat"
    assert payload["feature_affinity"][0]["feature"] == "chat"


@pytest.mark.asyncio
async def test_check_in_uses_weekly_streak_freeze_when_gap_is_two_days(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    now = datetime(2026, 4, 15, 13, 0, tzinfo=timezone.utc)
    monkeypatch.setattr(personalization_module, "utc_now", lambda: now)

    db = FakeDB(
        materials=[],
        generated_contents=[],
        chat_sessions=[],
        game_attempts=[],
        analytics_events=[],
    )

    service = PersonalizationService(db)
    service.preferences_repo = FakePreferencesRepo(
        {
            "reminder_timezone": "Asia/Ho_Chi_Minh",
            "streak_current_days": 3,
            "streak_longest_days": 6,
            "streak_last_checkin_date": "2026-04-13",
            "streak_total_checkins": 8,
            "streak_freeze_used_week": 0,
            "streak_freeze_week_start": "2026-04-13",
            "weekly_goal_active_days": 5,
            "weekly_goal_minutes": 180,
            "weekly_goal_items": 6,
        }
    )

    result = await service.check_in("u1", use_streak_freeze=True)

    assert result["checked_in"] is True
    assert result["used_streak_freeze"] is True
    assert result["habit_overview"]["current_streak_days"] == 4
    assert result["habit_overview"]["freeze_used_this_week"] == 1
    assert result["habit_overview"]["freeze_remaining_this_week"] == 0


@pytest.mark.asyncio
async def test_dashboard_risk_alert_detects_inactivity_and_activity_drop(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    now = datetime(2026, 4, 16, 9, 0, tzinfo=timezone.utc)
    monkeypatch.setattr(personalization_module, "utc_now", lambda: now)

    previous_week_events = [
        {
            "user_id": "u1",
            "event_type": "chat_message_sent",
            "created_at": now - timedelta(days=9, hours=index),
        }
        for index in range(12)
    ]
    current_week_events = [
        {
            "user_id": "u1",
            "event_type": "chat_message_sent",
            "created_at": now - timedelta(days=4),
        }
    ]

    db = FakeDB(
        materials=[],
        generated_contents=[],
        chat_sessions=[],
        game_attempts=[],
        analytics_events=previous_week_events + current_week_events,
    )

    service = PersonalizationService(db)
    service.preferences_repo = FakePreferencesRepo(
        {
            "reminder_timezone": "Asia/Ho_Chi_Minh",
            "weekly_goal_active_days": 5,
            "weekly_goal_minutes": 180,
            "weekly_goal_items": 6,
        }
    )

    payload = await service.build_dashboard_personalization("u1")

    assert payload["risk_alert"]["status"] in {"warning", "high_risk"}
    assert len(payload["risk_alert"]["reasons"]) >= 1
