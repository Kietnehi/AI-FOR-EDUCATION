from __future__ import annotations

import asyncio
import hashlib
import re
import smtplib
from datetime import date, datetime, time, timedelta, timezone
from email.message import EmailMessage
from uuid import uuid4
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from bson import ObjectId
from motor.motor_asyncio import AsyncIOMotorDatabase
from redis import asyncio as redis_async
from redis.exceptions import RedisError

from app.core.config import settings
from app.core.logging import logger
from app.repositories.analytics_event_repository import AnalyticsEventRepository
from app.repositories.user_preferences_repository import UserPreferencesRepository
from app.utils.time import utc_now


class PersonalizationService:
    EVENT_FEATURE_MAP = {
        "material_created": "materials",
        "material_uploaded": "materials",
        "material_viewed": "materials",
        "material_process_requested": "materials",
        "generation_requested": "generation",
        "chat_session_created": "chat",
        "chat_message_sent": "chat",
        "chat_message_stream_requested": "chat",
        "mascot_message_sent": "chat",
        "chat_web_search_used": "web_search",
        "chat_web_search_stream_requested": "web_search",
        "web_search_used": "web_search",
        "converter_used": "converter",
        "converter_extract_used": "converter",
        "game_attempt_submitted": "minigame",
        "remediation_quick_start_used": "minigame",
        "personalization_dashboard_viewed": "personalization",
        "personalization_preferences_viewed": "personalization",
        "personalization_preferences_updated": "personalization",
        "personalization_daily_checkin": "personalization",
        "personalization_email_reminder_sent": "personalization",
        "personalization_email_reminder_failed": "personalization",
        "personalization_email_reminder_skipped": "personalization",
    }

    def __init__(self, db: AsyncIOMotorDatabase) -> None:
        self.db = db
        self.preferences_repo = UserPreferencesRepository(db)
        self.analytics_repo = AnalyticsEventRepository(db)

    @staticmethod
    def _build_reminder_lock_key(user_id: str, local_day: date) -> str:
        return f"personalization:reminder_email_lock:{user_id}:{local_day.isoformat()}"

    async def _acquire_reminder_lock(self, key: str) -> tuple[redis_async.Redis | None, str | None]:
        token = uuid4().hex
        try:
            client = redis_async.from_url(settings.redis_url, decode_responses=True)
            acquired = await client.set(
                key,
                token,
                nx=True,
                ex=max(settings.personalization_reminder_lock_ttl_seconds, 60),
            )
            if not acquired:
                await client.aclose()
                return None, None
            return client, token
        except RedisError as exc:
            logger.warning("Redis lock unavailable for reminder key=%s: %s", key, exc)
            return None, None

    async def _release_reminder_lock(
        self,
        client: redis_async.Redis | None,
        key: str,
        token: str | None,
    ) -> None:
        if client is None:
            return
        try:
            if token:
                # Release only when lock token matches this execution.
                await client.eval(
                    "if redis.call('GET', KEYS[1]) == ARGV[1] then return redis.call('DEL', KEYS[1]) else return 0 end",
                    1,
                    key,
                    token,
                )
        except RedisError as exc:
            logger.warning("Failed to release reminder lock key=%s: %s", key, exc)
        finally:
            await client.aclose()

    async def get_or_init_preferences(self, user_id: str) -> dict:
        return await self.preferences_repo.get_or_create_by_user_id(user_id)

    async def update_preferences(self, user_id: str, payload: dict) -> dict:
        return await self.preferences_repo.upsert_by_user_id(user_id, payload)

    @staticmethod
    def _sanitize_metadata_value(value, depth: int = 0):
        if depth > settings.personalization_event_max_depth:
            return None

        if value is None or isinstance(value, (bool, int, float)):
            return value

        if isinstance(value, str):
            return value.strip()[: settings.personalization_event_max_string_length]

        if isinstance(value, dict):
            blocked_keys = {
                "message",
                "raw_text",
                "content",
                "answer",
                "reasoning",
                "reasoning_details",
                "prompt",
                "query",
                "input_text",
                "output_text",
            }
            sanitized: dict[str, object] = {}
            for index, (key, item) in enumerate(value.items()):
                if index >= settings.personalization_event_max_metadata_keys:
                    break
                safe_key = str(key).strip()[:64]
                if not safe_key:
                    continue
                if safe_key.lower() in blocked_keys:
                    continue
                sanitized_item = PersonalizationService._sanitize_metadata_value(item, depth + 1)
                if sanitized_item is None and item is not None:
                    continue
                sanitized[safe_key] = sanitized_item
            return sanitized

        if isinstance(value, (list, tuple, set)):
            sanitized_list: list[object] = []
            for item in list(value)[: settings.personalization_event_max_list_items]:
                sanitized_item = PersonalizationService._sanitize_metadata_value(item, depth + 1)
                if sanitized_item is None and item is not None:
                    continue
                sanitized_list.append(sanitized_item)
            return sanitized_list

        return str(value)[: settings.personalization_event_max_string_length]

    @staticmethod
    def sanitize_metadata(metadata: dict | None) -> dict:
        if not metadata:
            return {}
        value = PersonalizationService._sanitize_metadata_value(metadata)
        return value if isinstance(value, dict) else {}

    @staticmethod
    def _coerce_bool(value, default: bool) -> bool:
        if isinstance(value, bool):
            return value
        if isinstance(value, str):
            lowered = value.strip().lower()
            if lowered in {"true", "1", "yes", "on"}:
                return True
            if lowered in {"false", "0", "no", "off"}:
                return False
        return default

    @staticmethod
    def _coerce_int(
        value,
        default: int,
        minimum: int | None = None,
        maximum: int | None = None,
    ) -> int:
        try:
            parsed = int(value)
        except (TypeError, ValueError):
            parsed = default

        if minimum is not None:
            parsed = max(minimum, parsed)
        if maximum is not None:
            parsed = min(maximum, parsed)
        return parsed

    @staticmethod
    def _normalize_reminder_days_of_week(value) -> list[int]:
        source = value if isinstance(value, list) else settings.personalization_reminder_default_days_of_week
        cleaned: list[int] = []
        for item in source:
            try:
                day = int(item)
            except (TypeError, ValueError):
                continue
            if 0 <= day <= 6 and day not in cleaned:
                cleaned.append(day)
        return cleaned or [0, 1, 2, 3, 4, 5, 6]

    @staticmethod
    def _weekday_label_vi(weekday: int) -> str:
        labels = [
            "Thứ Hai",
            "Thứ Ba",
            "Thứ Tư",
            "Thứ Năm",
            "Thứ Sáu",
            "Thứ Bảy",
            "Chủ Nhật",
        ]
        if 0 <= weekday < len(labels):
            return labels[weekday]
        return "Ngày đã chọn"

    @classmethod
    def _is_reminder_day_allowed(cls, preferences: dict, now_local: datetime) -> bool:
        allowed_days = cls._normalize_reminder_days_of_week(preferences.get("reminder_days_of_week"))
        return now_local.weekday() in allowed_days

    @staticmethod
    def _segment_weekly_cap(segment: str) -> int:
        caps = {
            "active": settings.personalization_reminder_weekly_cap_active,
            "at_risk": settings.personalization_reminder_weekly_cap_at_risk,
            "returning": settings.personalization_reminder_weekly_cap_returning,
            "deep_focus": settings.personalization_reminder_weekly_cap_deep_focus,
        }
        return max(int(caps.get(segment, settings.personalization_reminder_weekly_cap_active)), 1)

    async def _count_sent_reminders_this_week(self, user_id: str, week_start_utc: datetime) -> int:
        rows = await self.db.analytics_events.find(
            {
                "user_id": user_id,
                "event_type": "personalization_email_reminder_sent",
                "created_at": {"$gte": week_start_utc},
            },
            projection={"_id": 1},
        ).limit(500).to_list(length=500)
        return len(rows)

    async def _has_recent_learning_activity(self, user_id: str, since: datetime) -> bool:
        rows = await self.db.analytics_events.find(
            {
                "user_id": user_id,
                "created_at": {"$gte": since},
            },
            projection={"event_type": 1, "created_at": 1},
        ).sort("created_at", -1).limit(50).to_list(length=50)
        reminder_events = {
            "personalization_email_reminder_sent",
            "personalization_email_reminder_failed",
            "personalization_email_reminder_skipped",
        }
        return any(str(row.get("event_type") or "") not in reminder_events for row in rows)

    async def _adaptive_reminder_hour(
        self,
        user_id: str,
        timezone_name: str,
        base_hour: int,
    ) -> int:
        since = utc_now() - timedelta(days=14)
        rows = await self.db.analytics_events.find(
            {
                "user_id": user_id,
                "created_at": {"$gte": since},
            },
            projection={"event_type": 1, "created_at": 1},
        ).sort("created_at", -1).limit(200).to_list(length=200)

        reminder_events = {
            "personalization_email_reminder_sent",
            "personalization_email_reminder_failed",
            "personalization_email_reminder_skipped",
        }
        hour_counts: dict[int, int] = {}
        for row in rows:
            if str(row.get("event_type") or "") in reminder_events:
                continue
            local_day = row.get("created_at")
            if not isinstance(local_day, datetime):
                continue
            local_hour = local_day.astimezone(ZoneInfo(timezone_name)).hour
            hour_counts[local_hour] = hour_counts.get(local_hour, 0) + 1

        if not hour_counts:
            return base_hour

        preferred_hour = max(
            hour_counts.items(),
            key=lambda item: (item[1], -abs(item[0] - base_hour)),
        )[0]
        blended = int(round((base_hour * 2 + preferred_hour) / 3))
        return max(base_hour, min(23, max(0, blended)))

    async def _resolve_reminder_segment(self, preferences: dict, dashboard_payload: dict) -> str:
        risk_status = str((dashboard_payload.get("risk_alert") or {}).get("status") or "stable")
        rhythm = dashboard_payload.get("study_rhythm") or {}
        days_since_last_active = rhythm.get("days_since_last_active")
        learning_pace = str(preferences.get("learning_pace") or "moderate")

        if risk_status in {"warning", "high_risk"}:
            return "at_risk"
        if isinstance(days_since_last_active, int) and days_since_last_active >= 3:
            return "returning"
        if learning_pace == "light":
            return "deep_focus"
        return "active"

    async def _choose_reminder_template_id(self, user_id: str, segment: str, local_today: date) -> str:
        template_map = {
            "active": ["progress_focus", "maintenance"],
            "at_risk": ["recovery", "progress_focus"],
            "returning": ["reconnect", "recovery"],
            "deep_focus": ["weekly_focus", "maintenance"],
        }
        candidates = template_map.get(segment, ["progress_focus", "maintenance"])

        rows = await self.db.analytics_events.find(
            {
                "user_id": user_id,
                "event_type": "personalization_email_reminder_sent",
            },
            projection={"metadata": 1, "created_at": 1},
        ).sort("created_at", -1).limit(3).to_list(length=3)
        recent_templates = [
            str((row.get("metadata") or {}).get("template_id") or "")
            for row in rows
        ]

        seed_text = f"{user_id}:{local_today.isoformat()}:{segment}"
        seed = int(hashlib.sha256(seed_text.encode("utf-8")).hexdigest(), 16)
        start = seed % len(candidates)
        for offset in range(len(candidates)):
            template_id = candidates[(start + offset) % len(candidates)]
            if template_id not in recent_templates[:2]:
                return template_id
        return candidates[start]

    async def _skip_reminder(
        self,
        user_id: str,
        reason_code: str,
        message: str,
        *,
        force: bool,
        segment: str | None = None,
        metadata: dict | None = None,
    ) -> dict:
        skip_metadata = {
            "reason_code": reason_code,
            "forced": bool(force),
        }
        if segment:
            skip_metadata["segment"] = segment
        if metadata:
            skip_metadata.update(metadata)

        await self.track_event(
            user_id=user_id,
            event_type="personalization_email_reminder_skipped",
            resource_type="reminder",
            metadata=skip_metadata,
        )
        return {
            "sent": False,
            "channel": "email",
            "message": message,
            "sent_at": None,
            "reason_code": reason_code,
            "segment": segment,
        }

    @staticmethod
    def _parse_iso_date(value) -> date | None:
        if value is None:
            return None
        if isinstance(value, datetime):
            return value.date()
        if isinstance(value, date):
            return value
        text = str(value).strip()
        if not text:
            return None
        try:
            return date.fromisoformat(text)
        except ValueError:
            return None

    @staticmethod
    def _safe_timezone_name(value: str | None) -> str:
        candidate = str(value or "").strip() or settings.personalization_default_timezone
        try:
            ZoneInfo(candidate)
            return candidate
        except ZoneInfoNotFoundError:
            return settings.personalization_default_timezone

    @staticmethod
    def _week_start(day: date) -> date:
        return day - timedelta(days=day.weekday())

    @classmethod
    def _week_boundaries_utc(
        cls,
        now: datetime,
        timezone_name: str,
    ) -> tuple[datetime, datetime, datetime]:
        tz = ZoneInfo(timezone_name)
        now_local = now.astimezone(tz)
        week_start_local = datetime.combine(
            cls._week_start(now_local.date()),
            time.min,
            tzinfo=tz,
        )
        week_start_utc = week_start_local.astimezone(timezone.utc)
        previous_week_start_utc = week_start_utc - timedelta(days=7)
        return week_start_utc, previous_week_start_utc, now_local

    @classmethod
    def _to_local_date(cls, value, timezone_name: str) -> date | None:
        if not isinstance(value, datetime):
            return None
        dt = value
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        try:
            return dt.astimezone(ZoneInfo(timezone_name)).date()
        except Exception:
            return dt.date()

    @classmethod
    def _normalize_preferences_fields(cls, preferences: dict, now: datetime) -> dict:
        timezone_name = cls._safe_timezone_name(preferences.get("reminder_timezone"))
        now_local = now.astimezone(ZoneInfo(timezone_name))
        current_week_start = cls._week_start(now_local.date()).isoformat()

        freeze_limit = max(
            cls._coerce_int(settings.personalization_streak_freeze_per_week, 1, minimum=0),
            0,
        )

        stored_week_start = cls._parse_iso_date(preferences.get("streak_freeze_week_start"))
        freeze_used_week = cls._coerce_int(
            preferences.get("streak_freeze_used_week"),
            0,
            minimum=0,
            maximum=freeze_limit,
        )
        if stored_week_start is None or stored_week_start.isoformat() != current_week_start:
            freeze_used_week = 0

        reminder_last_email_sent_date = cls._parse_iso_date(
            preferences.get("reminder_last_email_sent_date")
        )
        streak_last_checkin_date = cls._parse_iso_date(preferences.get("streak_last_checkin_date"))
        streak_last_freeze_date = cls._parse_iso_date(preferences.get("streak_last_freeze_date"))

        return {
            "reminder_timezone": timezone_name,
            "reminder_hour_local": cls._coerce_int(
                preferences.get("reminder_hour_local"),
                settings.personalization_default_reminder_hour_local,
                minimum=0,
                maximum=23,
            ),
            "reminder_days_of_week": cls._normalize_reminder_days_of_week(
                preferences.get("reminder_days_of_week")
            ),
            "reminder_in_app_enabled": cls._coerce_bool(
                preferences.get("reminder_in_app_enabled"),
                True,
            ),
            "reminder_email_enabled": cls._coerce_bool(
                preferences.get("reminder_email_enabled"),
                True,
            ),
            "weekly_goal_active_days": cls._coerce_int(
                preferences.get("weekly_goal_active_days"),
                settings.personalization_weekly_goal_default_active_days,
                minimum=1,
                maximum=7,
            ),
            "weekly_goal_minutes": cls._coerce_int(
                preferences.get("weekly_goal_minutes"),
                settings.personalization_weekly_goal_default_minutes,
                minimum=30,
                maximum=3000,
            ),
            "weekly_goal_items": cls._coerce_int(
                preferences.get("weekly_goal_items"),
                settings.personalization_weekly_goal_default_items,
                minimum=1,
                maximum=200,
            ),
            "streak_current_days": cls._coerce_int(
                preferences.get("streak_current_days"),
                0,
                minimum=0,
            ),
            "streak_longest_days": cls._coerce_int(
                preferences.get("streak_longest_days"),
                0,
                minimum=0,
            ),
            "streak_last_checkin_date": (
                streak_last_checkin_date.isoformat() if streak_last_checkin_date else None
            ),
            "streak_total_checkins": cls._coerce_int(
                preferences.get("streak_total_checkins"),
                0,
                minimum=0,
            ),
            "streak_freeze_used_week": freeze_used_week,
            "streak_freeze_week_start": current_week_start,
            "streak_last_freeze_date": (
                streak_last_freeze_date.isoformat() if streak_last_freeze_date else None
            ),
            "reminder_last_email_sent_date": (
                reminder_last_email_sent_date.isoformat()
                if reminder_last_email_sent_date
                else None
            ),
        }

    async def _ensure_habit_preferences(
        self,
        user_id: str,
        preferences: dict,
        now: datetime,
    ) -> dict:
        normalized = self._normalize_preferences_fields(preferences, now)
        patch = {
            key: value
            for key, value in normalized.items()
            if preferences.get(key) != value
        }
        if not patch:
            return {**preferences, **normalized}
        return await self.preferences_repo.upsert_by_user_id(user_id, patch)

    @staticmethod
    def _retention_status_from_active_days(active_days_7d: int) -> str:
        if active_days_7d >= 4:
            return "high"
        if active_days_7d >= 2:
            return "medium"
        if active_days_7d >= 1:
            return "low"
        return "inactive"

    @classmethod
    def _count_recent_feature_events(cls, events: list[dict]) -> dict[str, int]:
        counts: dict[str, int] = {}
        for event in events:
            feature = cls.EVENT_FEATURE_MAP.get(str(event.get("event_type") or ""))
            if not feature:
                continue
            counts[feature] = counts.get(feature, 0) + 1
        return counts

    @staticmethod
    def _build_feature_affinity(base_counts: dict[str, int], recent_counts: dict[str, int]) -> list[dict]:
        scored: dict[str, float] = {}
        for feature in set(base_counts.keys()) | set(recent_counts.keys()):
            base = float(base_counts.get(feature, 0))
            recent = float(recent_counts.get(feature, 0))
            scored[feature] = base + (recent * 2.0)

        max_score = max(scored.values()) if scored else 1.0
        if max_score <= 0:
            max_score = 1.0

        affinity = []
        for feature, raw in scored.items():
            recent = recent_counts.get(feature, 0)
            base = base_counts.get(feature, 0)
            if recent > 0:
                reason = f"Bạn dùng {feature} {recent} lần trong 7 ngày gần đây."
            elif base > 0:
                reason = "Bạn đã sử dụng tính năng này nhiều trong lịch sử học tập."
            else:
                reason = "Bạn chưa dùng nhiều tính năng này."
            affinity.append(
                {
                    "feature": feature,
                    "score": round((raw / max_score) * 100, 1),
                    "reason": reason,
                }
            )

        affinity.sort(key=lambda row: row["score"], reverse=True)
        return affinity

    @staticmethod
    def _clamp(value: float, minimum: float = 0.0, maximum: float = 1.0) -> float:
        return max(minimum, min(maximum, value))

    @staticmethod
    def _goal_tokens(text: str | None) -> set[str]:
        if not text:
            return set()
        tokens = {
            token
            for token in re.split(r"[^a-zA-Z0-9_]+", text.lower())
            if len(token) >= 3
        }
        return tokens

    @classmethod
    def _goal_match_score(cls, goal_tokens: set[str], material: dict) -> float:
        if not goal_tokens:
            return 0.0

        material_text_parts = [
            str(material.get("title") or ""),
            str(material.get("subject") or ""),
            str(material.get("description") or ""),
            " ".join(str(tag) for tag in (material.get("tags") or [])),
        ]
        material_tokens = cls._goal_tokens(" ".join(material_text_parts))
        if not material_tokens:
            return 0.0

        overlap = len(goal_tokens.intersection(material_tokens))
        score = overlap / max(len(goal_tokens), 1)
        return cls._clamp(score)

    @classmethod
    def _attempt_metrics_by_material(cls, game_attempts: list[dict]) -> dict[str, dict]:
        grouped: dict[str, list[dict]] = {}
        for attempt in game_attempts:
            material_id = attempt.get("material_id")
            if not material_id:
                continue
            grouped.setdefault(str(material_id), []).append(attempt)

        metrics: dict[str, dict] = {}
        for material_id, attempts in grouped.items():
            sorted_attempts = sorted(
                attempts,
                key=lambda row: row.get("completed_at") or row.get("created_at"),
                reverse=True,
            )

            accuracies: list[float] = []
            for row in sorted_attempts:
                max_score = float(row.get("max_score") or 0)
                if max_score <= 0:
                    continue
                score = float(row.get("score") or 0)
                accuracies.append(cls._clamp(score / max_score))

            if not accuracies:
                continue

            recent = accuracies[:3]
            previous = accuracies[3:6]
            recent_avg = sum(recent) / len(recent)
            previous_avg = (sum(previous) / len(previous)) if previous else recent_avg

            metrics[material_id] = {
                "attempt_count": len(accuracies),
                "recent_avg": recent_avg,
                "overall_avg": sum(accuracies) / len(accuracies),
                "trend": recent_avg - previous_avg,
            }

        return metrics

    @classmethod
    def _ranking_weights(cls, learning_pace: str) -> dict[str, float]:
        if learning_pace == "intensive":
            return {
                "recency": 0.25,
                "engagement": 0.2,
                "practice_priority": 0.4,
                "goal": 0.15,
            }
        if learning_pace == "light":
            return {
                "recency": 0.45,
                "engagement": 0.25,
                "practice_priority": 0.2,
                "goal": 0.1,
            }
        return {
            "recency": 0.35,
            "engagement": 0.25,
            "practice_priority": 0.25,
            "goal": 0.15,
        }

    @classmethod
    def _build_material_reason(
        cls,
        recency_score: float,
        practice_priority: float,
        trend: float,
        goal_match: float,
    ) -> str:
        reasons: list[str] = []
        if goal_match >= 0.25:
            reasons.append("Nội dung này khớp với mục tiêu học tập hiện tại của bạn.")
        if practice_priority >= 0.55:
            reasons.append("Độ chính xác gần đây còn thấp, nên ôn tập để cải thiện.")
        if trend <= -0.08:
            reasons.append("Kết quả các lượt gần đây đang giảm, cần luyện thêm.")
        elif trend >= 0.08:
            reasons.append("Bạn đang tiến bộ tốt ở học liệu này, nên duy trì mạch học.")
        if recency_score >= 0.6:
            reasons.append("Bạn vừa tương tác gần đây, tiếp tục ngay sẽ giữ nhịp học tốt hơn.")

        if reasons:
            return " ".join(reasons[:2])
        return "Học liệu phù hợp để tiếp tục trong lộ trình hiện tại."

    @classmethod
    def _rank_continue_learning(
        cls,
        materials: list[dict],
        material_metrics: dict[str, dict],
        material_activity: dict[str, dict],
        generated_counts_by_material: dict[str, int],
        chat_counts_by_material: dict[str, int],
        learning_pace: str,
        study_goal: str | None,
        now,
    ) -> list[dict]:
        if not materials:
            return []

        max_engagement = 1
        engagement_by_material: dict[str, int] = {}
        for material in materials:
            material_id = str(material.get("_id"))
            engagement = (
                generated_counts_by_material.get(material_id, 0)
                + chat_counts_by_material.get(material_id, 0)
                + int(material_metrics.get(material_id, {}).get("attempt_count", 0))
            )
            engagement_by_material[material_id] = engagement
            if engagement > max_engagement:
                max_engagement = engagement

        weights = cls._ranking_weights(learning_pace)
        goal_tokens = cls._goal_tokens(study_goal)

        ranked: list[dict] = []
        for material in materials:
            material_id = str(material.get("_id"))
            activity = material_activity.get(material_id, {})
            last_activity_at = activity.get("last_activity_at") or material.get("updated_at")
            trend = float(material_metrics.get(material_id, {}).get("trend", 0.0))
            recent_avg = float(material_metrics.get(material_id, {}).get("recent_avg", 0.0))
            has_attempt_data = material_id in material_metrics

            days_since = 14
            if last_activity_at is not None:
                try:
                    days_since = max((now.date() - last_activity_at.date()).days, 0)
                except Exception:
                    days_since = 14

            recency_score = cls._clamp(1.0 - (days_since / 30.0))
            engagement_score = cls._clamp(engagement_by_material.get(material_id, 0) / max_engagement)

            if has_attempt_data:
                practice_priority = cls._clamp((1.0 - recent_avg) + (max(-trend, 0.0) * 0.6))
            else:
                practice_priority = 0.35

            goal_match = cls._goal_match_score(goal_tokens, material)

            final_score = (
                (weights["recency"] * recency_score)
                + (weights["engagement"] * engagement_score)
                + (weights["practice_priority"] * practice_priority)
                + (weights["goal"] * goal_match)
            )

            ranked.append(
                {
                    "material_id": material_id,
                    "title": material.get("title") or "Hoc lieu chua dat ten",
                    "subject": material.get("subject"),
                    "last_activity_at": last_activity_at,
                    "reason": cls._build_material_reason(
                        recency_score=recency_score,
                        practice_priority=practice_priority,
                        trend=trend,
                        goal_match=goal_match,
                    ),
                    "recommendation_score": round(final_score * 100, 1),
                }
            )

        ranked.sort(key=lambda item: item.get("recommendation_score", 0.0), reverse=True)
        return ranked[:3]

    @classmethod
    def _build_weekly_goal_progress(
        cls,
        events_this_week: list[dict],
        preferences: dict,
        timezone_name: str,
        week_start_date: date,
    ) -> dict:
        active_days_goal = cls._coerce_int(
            preferences.get("weekly_goal_active_days"),
            settings.personalization_weekly_goal_default_active_days,
            minimum=1,
            maximum=7,
        )
        minutes_goal = cls._coerce_int(
            preferences.get("weekly_goal_minutes"),
            settings.personalization_weekly_goal_default_minutes,
            minimum=30,
        )
        items_goal = cls._coerce_int(
            preferences.get("weekly_goal_items"),
            settings.personalization_weekly_goal_default_items,
            minimum=1,
        )

        active_days: set[str] = set()
        total_duration_ms = 0
        events_without_duration = 0
        completed_items = 0
        completion_event_types = {
            "material_created",
            "material_uploaded",
            "material_process_requested",
            "generation_requested",
            "chat_session_created",
            "web_search_used",
            "chat_web_search_used",
            "converter_used",
            "converter_extract_used",
            "game_attempt_submitted",
        }

        for event in events_this_week:
            local_day = cls._to_local_date(event.get("created_at"), timezone_name)
            if local_day is not None and local_day >= week_start_date:
                active_days.add(local_day.isoformat())

            duration_ms = event.get("duration_ms")
            if isinstance(duration_ms, (int, float)) and duration_ms > 0:
                total_duration_ms += int(duration_ms)
            else:
                events_without_duration += 1

            if str(event.get("event_type") or "") in completion_event_types:
                completed_items += 1

        checkin_day = cls._parse_iso_date(preferences.get("streak_last_checkin_date"))
        if checkin_day is not None and checkin_day >= week_start_date:
            active_days.add(checkin_day.isoformat())

        tracked_minutes = int(round(total_duration_ms / 60000))
        estimated_minutes = tracked_minutes + (events_without_duration * 2)

        progress_components = [
            cls._clamp(len(active_days) / active_days_goal),
            cls._clamp(estimated_minutes / max(minutes_goal, 1)),
            cls._clamp(completed_items / max(items_goal, 1)),
        ]

        completion_rate = round((sum(progress_components) / len(progress_components)) * 100, 1)
        return {
            "active_days": len(active_days),
            "active_days_goal": active_days_goal,
            "minutes": max(estimated_minutes, 0),
            "minutes_goal": minutes_goal,
            "completed_items": completed_items,
            "completed_items_goal": items_goal,
            "completion_rate": completion_rate,
        }

    @classmethod
    def _build_habit_overview(
        cls,
        preferences: dict,
        events_this_week: list[dict],
        timezone_name: str,
        now_local_date: date,
    ) -> dict:
        last_checkin_date = cls._parse_iso_date(preferences.get("streak_last_checkin_date"))
        days_since_last_checkin = None
        if last_checkin_date is not None:
            days_since_last_checkin = max((now_local_date - last_checkin_date).days, 0)

        freeze_limit = max(
            cls._coerce_int(settings.personalization_streak_freeze_per_week, 1, minimum=0),
            0,
        )
        freeze_used = cls._coerce_int(
            preferences.get("streak_freeze_used_week"),
            0,
            minimum=0,
            maximum=freeze_limit,
        )

        week_start_date = cls._week_start(now_local_date)
        weekly_goal = cls._build_weekly_goal_progress(
            events_this_week=events_this_week,
            preferences=preferences,
            timezone_name=timezone_name,
            week_start_date=week_start_date,
        )

        return {
            "checkin_today": last_checkin_date == now_local_date,
            "current_streak_days": cls._coerce_int(
                preferences.get("streak_current_days"),
                0,
                minimum=0,
            ),
            "longest_streak_days": cls._coerce_int(
                preferences.get("streak_longest_days"),
                0,
                minimum=0,
            ),
            "last_checkin_date": last_checkin_date.isoformat() if last_checkin_date else None,
            "days_since_last_checkin": days_since_last_checkin,
            "freeze_used_this_week": freeze_used,
            "freeze_remaining_this_week": max(freeze_limit - freeze_used, 0),
            "week_start": week_start_date.isoformat(),
            "weekly_goal": weekly_goal,
        }

    @classmethod
    def _build_reminders(
        cls,
        preferences: dict,
        now_local: datetime,
        checkin_today: bool,
    ) -> list[dict]:
        reminders: list[dict] = []
        reminder_hour = cls._coerce_int(
            preferences.get("reminder_hour_local"),
            settings.personalization_default_reminder_hour_local,
            minimum=0,
            maximum=23,
        )
        hour_text = f"{reminder_hour:02d}:00"
        allowed_today = cls._is_reminder_day_allowed(preferences, now_local)
        weekday_text = cls._weekday_label_vi(now_local.weekday())

        if cls._coerce_bool(preferences.get("reminder_in_app_enabled"), True):
            due_now = (not checkin_today) and allowed_today and (now_local.hour >= reminder_hour)
            if not allowed_today:
                message = f"Hôm nay ({weekday_text}) không nằm trong ngày nhắc học bạn đã chọn."
            elif due_now:
                message = "Đã đến giờ học quen thuộc của bạn. Điểm danh ngay để giữ streak hôm nay."
            else:
                message = f"Nhắc học trong app sẽ hoạt động lúc {hour_text} (giờ địa phương)."
            reminders.append(
                {
                    "channel": "in_app",
                    "title": "Nhắc học trong ứng dụng",
                    "message": message,
                    "due_now": due_now,
                }
            )

        if cls._coerce_bool(preferences.get("reminder_email_enabled"), True):
            sent_today = cls._parse_iso_date(preferences.get("reminder_last_email_sent_date")) == now_local.date()
            due_now = (not checkin_today) and allowed_today and (now_local.hour >= reminder_hour) and not sent_today
            if not allowed_today:
                message = f"Email nhắc học không gửi vào {weekday_text} theo lịch bạn đã chọn."
            elif sent_today:
                message = "Email nhắc học cho hôm nay đã được gửi."
            elif due_now:
                message = "Bạn đã đến giờ học, có thể gửi email nhắc học ngay."
            else:
                message = f"Email nhắc học sẽ sẵn sàng từ {hour_text} nếu bạn chưa điểm danh."
            reminders.append(
                {
                    "channel": "email",
                    "title": "Nhắc học qua email",
                    "message": message,
                    "due_now": due_now,
                }
            )

        return reminders

    @classmethod
    def _build_risk_alert(
        cls,
        days_since_last_active: int | None,
        events_this_week_count: int,
        events_previous_week_count: int,
    ) -> dict:
        reasons: list[str] = []
        suggested_actions: list[str] = []

        inactive_days_threshold = cls._coerce_int(
            settings.personalization_risk_inactive_days,
            3,
            minimum=1,
        )
        min_prev_events = cls._coerce_int(
            settings.personalization_risk_min_previous_week_events,
            6,
            minimum=1,
        )
        drop_threshold = cls._clamp(
            float(settings.personalization_risk_activity_drop_threshold),
            minimum=0.05,
            maximum=0.95,
        )

        if days_since_last_active is not None and days_since_last_active >= inactive_days_threshold:
            reasons.append(
                f"Bạn đã gián đoạn học {days_since_last_active} ngày, vượt ngưỡng theo dõi {inactive_days_threshold} ngày."
            )

        drop_ratio = 0.0
        if events_previous_week_count >= min_prev_events:
            drop_ratio = (
                (events_previous_week_count - events_this_week_count)
                / max(events_previous_week_count, 1)
            )
            if drop_ratio >= drop_threshold:
                reasons.append(
                    f"Mức độ hoạt động tuần này giảm {round(drop_ratio * 100, 1)}% so với tuần trước."
                )

        if not reasons:
            return {
                "status": "stable",
                "reasons": [],
                "suggested_actions": [],
            }

        suggested_actions.append("Bắt đầu lại bằng 1 phiên học ngắn 10-15 phút hôm nay.")
        suggested_actions.append("Ưu tiên mục Continue Learning để quay lại mạch học gần nhất.")
        if drop_ratio >= drop_threshold:
            suggested_actions.append("Đặt mục tiêu tuần thấp hơn tạm thời để lấy lại đà học ổn định.")

        high_risk = len(reasons) >= 2 or (
            days_since_last_active is not None
            and days_since_last_active >= (inactive_days_threshold + 2)
        )

        return {
            "status": "high_risk" if high_risk else "warning",
            "reasons": reasons,
            "suggested_actions": suggested_actions[:3],
        }

    @staticmethod
    def _send_email_message_sync(message: EmailMessage) -> None:
        with smtplib.SMTP_SSL(settings.smtp_host, settings.smtp_port, timeout=15) as server:
            server.login(settings.smtp_user, settings.smtp_pass)
            server.send_message(message)

    @staticmethod
    def _is_transient_smtp_error(exc: smtplib.SMTPException) -> bool:
        if isinstance(exc, (smtplib.SMTPServerDisconnected, smtplib.SMTPConnectError)):  # type: ignore[arg-type]
            return True
        if isinstance(exc, smtplib.SMTPResponseException):
            code = int(getattr(exc, "smtp_code", 0) or 0)
            return 400 <= code < 500
        return False

    async def track_event(
        self,
        user_id: str,
        event_type: str,
        resource_type: str | None = None,
        resource_id: str | None = None,
        metadata: dict | None = None,
        success: bool = True,
        duration_ms: int | None = None,
    ) -> None:
        now = utc_now()
        expires_at = now + timedelta(days=max(settings.personalization_event_retention_days, 1))
        event_doc = {
            "user_id": user_id,
            "event_type": event_type,
            "resource_type": resource_type,
            "resource_id": resource_id,
            "metadata": self.sanitize_metadata(metadata),
            "success": success,
            "duration_ms": duration_ms,
            "created_at": now,
            "expires_at": expires_at,
        }
        try:
            await self.analytics_repo.create(event_doc)
        except Exception as exc:
            logger.warning("Failed to write analytics event '%s': %s", event_type, exc)

    async def check_in(self, user_id: str, use_streak_freeze: bool = False) -> dict:
        now = utc_now()
        preferences = await self.get_or_init_preferences(user_id)
        preferences = await self._ensure_habit_preferences(user_id, preferences, now)

        timezone_name = self._safe_timezone_name(preferences.get("reminder_timezone"))
        now_local = now.astimezone(ZoneInfo(timezone_name))
        today = now_local.date()

        freeze_limit = max(
            self._coerce_int(settings.personalization_streak_freeze_per_week, 1, minimum=0),
            0,
        )
        freeze_used = self._coerce_int(
            preferences.get("streak_freeze_used_week"),
            0,
            minimum=0,
            maximum=freeze_limit,
        )

        last_checkin_date = self._parse_iso_date(preferences.get("streak_last_checkin_date"))
        current_streak = self._coerce_int(preferences.get("streak_current_days"), 0, minimum=0)
        longest_streak = self._coerce_int(preferences.get("streak_longest_days"), 0, minimum=0)
        total_checkins = self._coerce_int(preferences.get("streak_total_checkins"), 0, minimum=0)

        already_checked_in_today = last_checkin_date == today
        used_streak_freeze = False
        checked_in = False

        if already_checked_in_today:
            message = "Bạn đã điểm danh hôm nay rồi."
        else:
            gap_days = None
            if last_checkin_date is not None:
                gap_days = max((today - last_checkin_date).days, 0)

            next_streak = 1
            next_freeze_used = freeze_used
            next_last_freeze_date = preferences.get("streak_last_freeze_date")

            if gap_days is None:
                next_streak = 1
            elif gap_days == 1:
                next_streak = max(current_streak + 1, 1)
            elif gap_days == 2 and use_streak_freeze and freeze_used < freeze_limit:
                next_streak = max(current_streak + 1, 1)
                next_freeze_used = freeze_used + 1
                next_last_freeze_date = today.isoformat()
                used_streak_freeze = True
            else:
                next_streak = 1

            checked_in = True
            next_longest_streak = max(longest_streak, next_streak)
            update_payload = {
                "streak_current_days": next_streak,
                "streak_longest_days": next_longest_streak,
                "streak_last_checkin_date": today.isoformat(),
                "streak_total_checkins": total_checkins + 1,
                "streak_freeze_used_week": next_freeze_used,
                "streak_last_freeze_date": next_last_freeze_date,
            }
            await self.update_preferences(user_id, update_payload)

            if used_streak_freeze:
                message = "Điểm danh thành công và đã dùng 1 lượt đóng băng streak tuần này."
            else:
                message = "Điểm danh thành công."

        await self.track_event(
            user_id=user_id,
            event_type="personalization_daily_checkin",
            resource_type="habit",
            metadata={
                "already_checked_in_today": already_checked_in_today,
                "used_streak_freeze": used_streak_freeze,
                "requested_streak_freeze": bool(use_streak_freeze),
            },
        )

        dashboard_payload = await self.build_dashboard_personalization(user_id)
        return {
            "checked_in": checked_in,
            "already_checked_in_today": already_checked_in_today,
            "used_streak_freeze": used_streak_freeze,
            "message": message,
            "habit_overview": dashboard_payload["habit_overview"],
        }

    async def send_learning_reminder_email(
        self,
        user_id: str,
        recipient_email: str,
        recipient_name: str | None = None,
        force: bool = True,
    ) -> dict:
        if not recipient_email:
            return {
                "sent": False,
                "channel": "email",
                "message": "Không tìm thấy email người dùng để gửi nhắc học.",
                "sent_at": None,
            }

        if not settings.smtp_host or not settings.smtp_user or not settings.smtp_pass:
            return {
                "sent": False,
                "channel": "email",
                "message": "SMTP chưa được cấu hình, chưa thể gửi email nhắc học.",
                "sent_at": None,
            }

        now = utc_now()
        preferences = await self.get_or_init_preferences(user_id)
        preferences = await self._ensure_habit_preferences(user_id, preferences, now)

        timezone_name = self._safe_timezone_name(preferences.get("reminder_timezone"))
        now_local = now.astimezone(ZoneInfo(timezone_name))
        today = now_local.date()

        reminder_email_enabled = self._coerce_bool(preferences.get("reminder_email_enabled"), True)
        reminder_hour = self._coerce_int(
            preferences.get("reminder_hour_local"),
            settings.personalization_default_reminder_hour_local,
            minimum=0,
            maximum=23,
        )
        reminder_days_of_week = self._normalize_reminder_days_of_week(
            preferences.get("reminder_days_of_week")
        )
        checkin_today = self._parse_iso_date(preferences.get("streak_last_checkin_date")) == today
        reminder_last_email_sent_date = self._parse_iso_date(
            preferences.get("reminder_last_email_sent_date")
        )
        day_allowed = now_local.weekday() in reminder_days_of_week
        day_labels = ", ".join(self._weekday_label_vi(day) for day in reminder_days_of_week)

        if not force:
            if not reminder_email_enabled:
                return await self._skip_reminder(
                    user_id=user_id,
                    reason_code="disabled",
                    message="Bạn đang tắt nhắc học qua email.",
                    force=force,
                )
            if not day_allowed:
                return await self._skip_reminder(
                    user_id=user_id,
                    reason_code="day_not_selected",
                    message=f"Hôm nay không thuộc lịch nhắc học bạn đã chọn ({day_labels}).",
                    force=force,
                    metadata={"today_weekday": now_local.weekday()},
                )
            if checkin_today:
                return await self._skip_reminder(
                    user_id=user_id,
                    reason_code="checked_in_today",
                    message="Hôm nay bạn đã điểm danh, chưa cần gửi email nhắc học.",
                    force=force,
                )
            if reminder_last_email_sent_date == today:
                return await self._skip_reminder(
                    user_id=user_id,
                    reason_code="sent_today",
                    message="Email nhắc học hôm nay đã được gửi trước đó.",
                    force=force,
                )

            effective_reminder_hour = await self._adaptive_reminder_hour(
                user_id=user_id,
                timezone_name=timezone_name,
                base_hour=reminder_hour,
            )
            if now_local.hour < effective_reminder_hour:
                return await self._skip_reminder(
                    user_id=user_id,
                    reason_code="before_effective_hour",
                    message=f"Chưa đến khung giờ nhắc học hiệu lực ({effective_reminder_hour:02d}:00).",
                    force=force,
                    metadata={
                        "base_hour": reminder_hour,
                        "effective_hour": effective_reminder_hour,
                    },
                )

            suppression_minutes = max(
                int(settings.personalization_reminder_recent_activity_suppression_minutes),
                15,
            )
            if await self._has_recent_learning_activity(
                user_id=user_id,
                since=now - timedelta(minutes=suppression_minutes),
            ):
                return await self._skip_reminder(
                    user_id=user_id,
                    reason_code="recent_activity",
                    message="Bạn vừa có hoạt động học gần đây, hệ thống tạm bỏ qua email để tránh gây nhiễu.",
                    force=force,
                    metadata={"suppression_minutes": suppression_minutes},
                )

        dashboard_payload = await self.build_dashboard_personalization(user_id)
        habit = dashboard_payload.get("habit_overview", {})
        weekly_goal = habit.get("weekly_goal", {})
        next_actions = dashboard_payload.get("next_actions", [])
        segment = await self._resolve_reminder_segment(preferences, dashboard_payload)
        template_id = await self._choose_reminder_template_id(user_id, segment, today)

        if not force:
            week_start_utc, _, _ = self._week_boundaries_utc(now, timezone_name)
            sent_this_week = await self._count_sent_reminders_this_week(user_id, week_start_utc)
            weekly_cap = self._segment_weekly_cap(segment)
            if sent_this_week >= weekly_cap:
                return await self._skip_reminder(
                    user_id=user_id,
                    reason_code="weekly_cap_reached",
                    message=f"Bạn đã đạt giới hạn {weekly_cap} email nhắc học trong tuần này.",
                    force=force,
                    segment=segment,
                    metadata={"sent_this_week": sent_this_week, "weekly_cap": weekly_cap},
                )

        completion_rate = float(weekly_goal.get("completion_rate") or 0)
        if completion_rate < 40:
            primary_action = "Mở dashboard và hoàn thành ngay 1 tác vụ học ngắn trong 10 phút."
        elif completion_rate < 75:
            primary_action = "Tiếp tục bài đang dở để tăng tiến độ mục tiêu tuần ngay hôm nay."
        else:
            primary_action = "Duy trì nhịp học bằng một phiên ôn tập nhanh để giữ streak."

        secondary_action = next_actions[1] if len(next_actions) > 1 else "Điểm danh ngay khi vào hệ thống để không mất chuỗi học tập."

        if segment == "at_risk":
            subject = "Bạn đang có dấu hiệu giảm nhịp học, học nhanh 10 phút ngay nhé"
        elif segment == "returning":
            subject = "Chào mừng bạn quay lại, cùng khởi động lại nhịp học hôm nay"
        elif segment == "deep_focus":
            subject = "Một nhịp học gọn nhẹ để giữ tiến độ tuần"
        else:
            subject = "Nhắc học hôm nay từ AI Learning Studio"

        message = EmailMessage()
        message["Subject"] = subject
        message["From"] = settings.smtp_user
        message["To"] = recipient_email
        body_lines = [
            f"Xin chào {recipient_name or 'bạn'},",
            "",
            "Đây là email nhắc học cá nhân hóa từ AI Learning Studio.",
            f"Bạn nhận email này vì hôm nay đến lịch nhắc học và bạn chưa điểm danh.",
            f"Phân khúc hiện tại: {segment}.",
            f"Streak hiện tại: {habit.get('current_streak_days', 0)} ngày.",
            f"Mục tiêu tuần: {completion_rate}% hoàn thành.",
            "",
            "Hành động chính:",
            f"- {primary_action}",
        ]
        if segment in {"at_risk", "returning"}:
            body_lines.extend([
                "",
                "Hành động phụ:",
                f"- {secondary_action}",
            ])
        elif next_actions:
            body_lines.extend([
                "",
                "Gợi ý tiếp theo:",
                f"- {next_actions[0]}",
            ])
        body_lines.extend([
            "",
            f"Khung ngày nhắc học hiện tại: {day_labels}.",
            "Bạn có thể đổi cấu hình nhắc học trong mục Tiến độ học tập.",
            "",
            "Chúc bạn học tập hiệu quả!",
        ])
        message.set_content(
            "\n".join(body_lines)
        )

        max_attempts = max(int(settings.personalization_reminder_transient_retry_attempts), 1)
        send_error: smtplib.SMTPException | None = None
        for attempt in range(1, max_attempts + 1):
            try:
                await asyncio.to_thread(self._send_email_message_sync, message)
                send_error = None
                break
            except smtplib.SMTPException as exc:
                send_error = exc
                is_transient = self._is_transient_smtp_error(exc)
                if is_transient and attempt < max_attempts:
                    await asyncio.sleep(min(2 ** (attempt - 1), 2))
                    continue
                logger.warning("Failed to send reminder email for user '%s': %s", user_id, exc)
                await self.track_event(
                    user_id=user_id,
                    event_type="personalization_email_reminder_failed",
                    resource_type="reminder",
                    metadata={
                        "forced": bool(force),
                        "reason": str(exc),
                        "transient": bool(is_transient),
                        "attempt": attempt,
                        "segment": segment,
                        "template_id": template_id,
                    },
                    success=False,
                )
                return {
                    "sent": False,
                    "channel": "email",
                    "message": "Không thể gửi email nhắc học lúc này.",
                    "sent_at": None,
                    "reason_code": "smtp_transient_failure" if is_transient else "smtp_permanent_failure",
                    "segment": segment,
                    "template_id": template_id,
                }

        if send_error is not None:
            return {
                "sent": False,
                "channel": "email",
                "message": "Không thể gửi email nhắc học lúc này.",
                "sent_at": None,
                "reason_code": "smtp_unknown_failure",
                "segment": segment,
                "template_id": template_id,
            }

        await self.update_preferences(
            user_id,
            {
                "reminder_last_email_sent_date": today.isoformat(),
            },
        )
        await self.track_event(
            user_id=user_id,
            event_type="personalization_email_reminder_sent",
            resource_type="reminder",
            metadata={
                "forced": bool(force),
                "segment": segment,
                "template_id": template_id,
                "completion_rate": completion_rate,
            },
        )

        return {
            "sent": True,
            "channel": "email",
            "message": "Đã gửi email nhắc học thành công.",
            "sent_at": now,
            "reason_code": "sent",
            "segment": segment,
            "template_id": template_id,
        }

    async def build_dashboard_personalization(self, user_id: str) -> dict:
        now = utc_now()
        preferences = await self.get_or_init_preferences(user_id)
        preferences = await self._ensure_habit_preferences(user_id, preferences, now)

        timezone_name = self._safe_timezone_name(preferences.get("reminder_timezone"))
        week_start_utc, previous_week_start_utc, now_local = self._week_boundaries_utc(now, timezone_name)
        since_7d = now - timedelta(days=7)

        materials_task = self.db.learning_materials.find(
            {"user_id": user_id},
            projection={
                "_id": 1,
                "title": 1,
                "subject": 1,
                "description": 1,
                "tags": 1,
                "updated_at": 1,
                "processing_status": 1,
            },
        ).sort("updated_at", -1).limit(40).to_list(length=40)
        generated_task = self.db.generated_contents.find(
            {"user_id": user_id},
            projection={"content_type": 1, "updated_at": 1, "material_id": 1},
        ).sort("updated_at", -1).limit(200).to_list(length=200)
        chat_sessions_task = self.db.chatbot_sessions.find(
            {"user_id": user_id},
            projection={"material_id": 1, "updated_at": 1},
        ).sort("updated_at", -1).limit(200).to_list(length=200)
        game_attempts_task = self.db.game_attempts.find(
            {"user_id": user_id},
            projection={"material_id": 1, "score": 1, "max_score": 1, "completed_at": 1},
        ).sort("completed_at", -1).limit(200).to_list(length=200)
        events_7d_task = self.db.analytics_events.find(
            {"user_id": user_id, "created_at": {"$gte": since_7d}},
            projection={"created_at": 1, "event_type": 1, "duration_ms": 1},
        ).sort("created_at", -1).limit(600).to_list(length=600)
        events_this_week_task = self.db.analytics_events.find(
            {"user_id": user_id, "created_at": {"$gte": week_start_utc}},
            projection={"created_at": 1, "event_type": 1, "duration_ms": 1},
        ).sort("created_at", -1).limit(1000).to_list(length=1000)
        events_previous_week_task = self.db.analytics_events.find(
            {
                "user_id": user_id,
                "created_at": {
                    "$gte": previous_week_start_utc,
                    "$lt": week_start_utc,
                },
            },
            projection={"created_at": 1, "event_type": 1, "duration_ms": 1},
        ).sort("created_at", -1).limit(1000).to_list(length=1000)
        last_event_task = self.db.analytics_events.find(
            {"user_id": user_id},
            projection={"created_at": 1},
        ).sort("created_at", -1).limit(1).to_list(length=1)

        (
            materials,
            generated_contents,
            chat_sessions,
            game_attempts,
            events_7d,
            events_this_week,
            events_previous_week,
            last_event_rows,
        ) = await asyncio.gather(
            materials_task,
            generated_task,
            chat_sessions_task,
            game_attempts_task,
            events_7d_task,
            events_this_week_task,
            events_previous_week_task,
            last_event_task,
        )

        generated_counts: dict[str, int] = {}
        for row in generated_contents:
            content_type = str(row.get("content_type") or "unknown")
            generated_counts[content_type] = generated_counts.get(content_type, 0) + 1

        accuracies: list[float] = []
        for attempt in game_attempts:
            max_score = float(attempt.get("max_score") or 0)
            if max_score <= 0:
                continue
            score = float(attempt.get("score") or 0)
            accuracies.append(max(0.0, min(1.0, score / max_score)))
        average_game_accuracy = round((sum(accuracies) / len(accuracies)) * 100, 1) if accuracies else 0.0

        material_activity: dict[str, dict] = {}
        for row in materials:
            material_id = str(row.get("_id"))
            material_activity[material_id] = {
                "last_activity_at": row.get("updated_at"),
                "activity_reason": "Bạn vừa cập nhật học liệu này gần đây.",
            }

        generated_counts_by_material: dict[str, int] = {}
        for row in generated_contents:
            material_id = row.get("material_id")
            if not material_id:
                continue
            key = str(material_id)
            generated_counts_by_material[key] = generated_counts_by_material.get(key, 0) + 1

        chat_counts_by_material: dict[str, int] = {}
        for row in chat_sessions:
            material_id = row.get("material_id")
            if not material_id:
                continue
            key = str(material_id)
            chat_counts_by_material[key] = chat_counts_by_material.get(key, 0) + 1

        material_metrics = self._attempt_metrics_by_material(game_attempts)

        def _touch_material(material_id: str | None, ts, reason: str) -> None:
            if not material_id:
                return
            key = str(material_id)
            existing = material_activity.get(key)
            if not existing:
                return
            current_ts = existing.get("last_activity_at")
            if current_ts is None or (ts is not None and ts > current_ts):
                existing["last_activity_at"] = ts
                existing["activity_reason"] = reason

        for row in chat_sessions:
            _touch_material(
                row.get("material_id"),
                row.get("updated_at"),
                "Bạn vừa có phiên hỏi đáp với chatbot cho học liệu này.",
            )

        for row in game_attempts:
            _touch_material(
                row.get("material_id"),
                row.get("completed_at"),
                "Bạn vừa làm minigame, nên ôn tập tiếp ngay để giữ nhịp học.",
            )

        for row in generated_contents:
            _touch_material(
                row.get("material_id"),
                row.get("updated_at"),
                "Bạn vừa tạo nội dung AI từ học liệu này, rất phù hợp để học tiếp.",
            )

        continue_learning = self._rank_continue_learning(
            materials=materials,
            material_metrics=material_metrics,
            material_activity=material_activity,
            generated_counts_by_material=generated_counts_by_material,
            chat_counts_by_material=chat_counts_by_material,
            learning_pace=str(preferences.get("learning_pace") or "moderate"),
            study_goal=preferences.get("study_goal"),
            now=now,
        )

        events_days = {
            local_day.isoformat()
            for item in events_7d
            for local_day in [self._to_local_date(item.get("created_at"), timezone_name)]
            if local_day is not None
        }
        active_days_7d = len(events_days)
        events_count_7d = len(events_7d)

        last_active_at = last_event_rows[0].get("created_at") if last_event_rows else None
        if last_active_at is None and continue_learning:
            last_active_at = continue_learning[0].get("last_activity_at")

        retention_status = self._retention_status_from_active_days(active_days_7d)
        days_since_last_active = None
        last_active_local_day = self._to_local_date(last_active_at, timezone_name)
        if last_active_local_day is not None:
            days_since_last_active = max((now_local.date() - last_active_local_day).days, 0)

        base_feature_counts = {
            "materials": len(materials),
            "generation": len(generated_contents),
            "chat": len(chat_sessions),
            "minigame": len(game_attempts),
            "web_search": 0,
            "converter": 0,
            "personalization": 0,
        }
        recent_feature_counts = self._count_recent_feature_events(events_7d)
        feature_affinity = self._build_feature_affinity(base_feature_counts, recent_feature_counts)
        top_feature = feature_affinity[0]["feature"] if feature_affinity else None

        habit_overview = self._build_habit_overview(
            preferences=preferences,
            events_this_week=events_this_week,
            timezone_name=timezone_name,
            now_local_date=now_local.date(),
        )
        reminders = self._build_reminders(
            preferences=preferences,
            now_local=now_local,
            checkin_today=bool(habit_overview.get("checkin_today")),
        )
        risk_alert = self._build_risk_alert(
            days_since_last_active=days_since_last_active,
            events_this_week_count=len(events_this_week),
            events_previous_week_count=len(events_previous_week),
        )

        next_actions: list[str] = []
        if not habit_overview.get("checkin_today"):
            next_actions.append("Điểm danh hôm nay để duy trì streak học tập.")
        if not materials:
            next_actions.append("Tải lên học liệu đầu tiên để bắt đầu cá nhân hóa.")
        if materials and generated_counts.get("slides", 0) == 0:
            next_actions.append("Tạo bộ slides đầu tiên từ học liệu bạn học gần đây.")
        if generated_counts.get("minigame", 0) > 0 and not game_attempts:
            next_actions.append("Hãy chơi một minigame để hệ thống hiểu điểm mạnh/yếu của bạn.")
        if chat_sessions:
            next_actions.append("Tiếp tục phiên chatbot gần nhất để giữ mạch học.")
        else:
            next_actions.append("Mở chatbot và đặt 1 câu hỏi nhanh để tăng retention phiên học.")
        if average_game_accuracy > 0 and average_game_accuracy < 60:
            next_actions.append("Độ chính xác còn thấp, ưu tiên ôn tập mức Dễ/Trung bình.")
        elif average_game_accuracy >= 85:
            next_actions.append("Hiệu suất rất tốt, thử mức Khó để tăng thử thách.")

        learning_pace = str(preferences.get("learning_pace") or "moderate")
        if learning_pace == "intensive":
            next_actions.append("Bạn đang chọn nhịp học chuyên sâu: ưu tiên 2 phiên ngắn mỗi ngày.")
        elif learning_pace == "light":
            next_actions.append("Bạn đang chọn nhịp học nhẹ: duy trì 1 phiên ngắn để giữ streak.")

        study_goal = str(preferences.get("study_goal") or "").strip()
        if study_goal:
            next_actions.append(f"Mục tiêu hiện tại: {study_goal}.")

        weekly_goal = habit_overview.get("weekly_goal") or {}
        if float(weekly_goal.get("completion_rate") or 0) < 60:
            next_actions.append("Tiến độ mục tiêu tuần còn thấp, hãy hoàn thành một tác vụ học ngắn hôm nay.")

        if risk_alert.get("status") in {"warning", "high_risk"}:
            first_reason = (risk_alert.get("reasons") or ["Bạn có dấu hiệu giảm nhịp học."])[0]
            next_actions.append(first_reason)

        if any(item.get("channel") == "email" and item.get("due_now") for item in reminders):
            next_actions.append("Đã đến giờ nhắc học, bạn có thể gửi email nhắc học ngay.")

        deduped_actions: list[str] = []
        for action in next_actions:
            if action not in deduped_actions:
                deduped_actions.append(action)

        return {
            "generated_counts": generated_counts,
            "continue_learning": continue_learning,
            "next_actions": deduped_actions[:5],
            "feature_affinity": feature_affinity,
            "study_rhythm": {
                "active_days_7d": active_days_7d,
                "events_7d": events_count_7d,
                "last_active_at": last_active_at,
                "retention_status": retention_status,
                "days_since_last_active": days_since_last_active,
                "top_feature": top_feature,
            },
            "habit_overview": habit_overview,
            "reminders": reminders,
            "risk_alert": risk_alert,
            "summary": {
                "materials_total": len(materials),
                "generated_total": len(generated_contents),
                "chat_sessions_total": len(chat_sessions),
                "game_attempts_total": len(game_attempts),
                "average_game_accuracy": average_game_accuracy,
            },
        }

    async def dispatch_scheduled_reminders(self) -> dict:
        now = utc_now()
        users_cursor = self.db.user_preferences.find(
            {"reminder_email_enabled": True},
            projection={"user_id": 1, "reminder_timezone": 1, "reminder_hour_local": 1}
        )
        users = await users_cursor.to_list(length=None)
        sent_count = 0
        skipped_locked = 0
        skipped_missing_user = 0
        skipped_by_reason: dict[str, int] = {}
        
        for user_doc in users:
            user_id = user_doc.get("user_id")
            if not user_id:
                continue
                
            try:
                # Avoid unnecessary processing if obviously not their time
                timezone_name = self._safe_timezone_name(user_doc.get("reminder_timezone"))
                tz = ZoneInfo(timezone_name)
                now_local = now.astimezone(tz)
                reminder_hour = self._coerce_int(
                    user_doc.get("reminder_hour_local"),
                    settings.personalization_default_reminder_hour_local,
                    0, 23
                )
                
                if now_local.hour >= reminder_hour:
                    lock_key = self._build_reminder_lock_key(user_id, now_local.date())
                    lock_client, lock_token = await self._acquire_reminder_lock(lock_key)
                    if lock_client is None:
                        skipped_locked += 1
                        continue

                    try:
                        if not ObjectId.is_valid(user_id):
                            skipped_missing_user += 1
                            continue

                        user_profile = await self.db.users.find_one(
                            {"_id": ObjectId(user_id)},
                            projection={"email": 1, "name": 1},
                        )
                        if not user_profile or not user_profile.get("email"):
                            skipped_missing_user += 1
                            continue

                        res = await self.send_learning_reminder_email(
                            user_id=user_id,
                            recipient_email=str(user_profile.get("email") or ""),
                            recipient_name=user_profile.get("name"),
                            force=False,
                        )
                        if res.get("sent"):
                            sent_count += 1
                        else:
                            reason_code = str(res.get("reason_code") or "unknown")
                            skipped_by_reason[reason_code] = skipped_by_reason.get(reason_code, 0) + 1
                    finally:
                        await self._release_reminder_lock(lock_client, lock_key, lock_token)
            except Exception as exc:
                logger.error("Error dispatching scheduled reminder for user %s: %s", user_id, exc)

        return {
            "status": "completed",
            "sent_count": sent_count,
            "skipped_locked": skipped_locked,
            "skipped_missing_user": skipped_missing_user,
            "skipped_by_reason": skipped_by_reason,
            "total_candidates": len(users),
        }
