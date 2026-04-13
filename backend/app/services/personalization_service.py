from __future__ import annotations

import asyncio
import re
from datetime import timedelta

from motor.motor_asyncio import AsyncIOMotorDatabase

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
    }

    def __init__(self, db: AsyncIOMotorDatabase) -> None:
        self.db = db
        self.preferences_repo = UserPreferencesRepository(db)
        self.analytics_repo = AnalyticsEventRepository(db)

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

    async def build_dashboard_personalization(self, user_id: str) -> dict:
        now = utc_now()
        since_7d = now - timedelta(days=7)
        preferences_task = self.get_or_init_preferences(user_id)

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
        events_task = self.db.analytics_events.find(
            {"user_id": user_id, "created_at": {"$gte": since_7d}},
            projection={"created_at": 1, "event_type": 1},
        ).sort("created_at", -1).limit(600).to_list(length=600)

        (
            materials,
            generated_contents,
            chat_sessions,
            game_attempts,
            events_7d,
            preferences,
        ) = await asyncio.gather(
            materials_task,
            generated_task,
            chat_sessions_task,
            game_attempts_task,
            events_task,
            preferences_task,
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
            str(item.get("created_at"))[:10]
            for item in events_7d
            if item.get("created_at") is not None
        }
        active_days_7d = len(events_days)
        events_count_7d = len(events_7d)

        last_active_at = None
        if events_7d:
            last_active_at = events_7d[0].get("created_at")
        elif continue_learning:
            last_active_at = continue_learning[0].get("last_activity_at")

        retention_status = self._retention_status_from_active_days(active_days_7d)
        days_since_last_active = None
        if last_active_at is not None:
            try:
                days_since_last_active = max((now.date() - last_active_at.date()).days, 0)
            except Exception:
                days_since_last_active = None

        next_actions: list[str] = []
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

        return {
            "generated_counts": generated_counts,
            "continue_learning": continue_learning,
            "next_actions": next_actions[:4],
            "feature_affinity": feature_affinity,
            "study_rhythm": {
                "active_days_7d": active_days_7d,
                "events_7d": events_count_7d,
                "last_active_at": last_active_at,
                "retention_status": retention_status,
                "days_since_last_active": days_since_last_active,
                "top_feature": top_feature,
            },
            "summary": {
                "materials_total": len(materials),
                "generated_total": len(generated_contents),
                "chat_sessions_total": len(chat_sessions),
                "game_attempts_total": len(game_attempts),
                "average_game_accuracy": average_game_accuracy,
            },
        }
