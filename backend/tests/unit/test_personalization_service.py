from __future__ import annotations

from app.core.config import settings
from app.services.personalization_service import PersonalizationService


def test_sanitize_metadata_strips_blocked_keys_and_trims_values() -> None:
    long_value = "x" * (settings.personalization_event_max_string_length + 40)

    metadata = {
        "message": "this should be removed",
        "safe_key": long_value,
        "nested": {
            "raw_text": "remove me",
            "reasoning": "remove me",
            "allowed": "ok",
        },
        "list": ["a", "b", {"content": "hidden", "visible": "yes"}],
    }

    sanitized = PersonalizationService.sanitize_metadata(metadata)

    assert "message" not in sanitized
    assert sanitized["safe_key"] == long_value[: settings.personalization_event_max_string_length]
    assert "raw_text" not in sanitized["nested"]
    assert "reasoning" not in sanitized["nested"]
    assert sanitized["nested"]["allowed"] == "ok"
    assert sanitized["list"][2] == {"visible": "yes"}


def test_sanitize_metadata_limits_collection_size() -> None:
    oversized_list = list(range(settings.personalization_event_max_list_items + 5))
    oversized_dict = {
        f"k{i}": i
        for i in range(settings.personalization_event_max_metadata_keys + 10)
    }

    sanitized = PersonalizationService.sanitize_metadata(
        {
            "list": oversized_list,
            "dict": oversized_dict,
        }
    )

    assert len(sanitized["list"]) == settings.personalization_event_max_list_items
    assert len(sanitized["dict"]) == settings.personalization_event_max_metadata_keys


def test_sanitize_metadata_enforces_max_depth() -> None:
    deep_payload = {
        "level1": {
            "level2": {
                "level3": {
                    "level4": {
                        "value": "drop at max depth"
                    }
                }
            }
        }
    }

    sanitized = PersonalizationService.sanitize_metadata(deep_payload)

    assert "level1" in sanitized
    assert "level2" in sanitized["level1"]
    assert "level3" in sanitized["level1"]["level2"]
    assert "level4" not in sanitized["level1"]["level2"]["level3"]


def test_retention_status_from_active_days() -> None:
    assert PersonalizationService._retention_status_from_active_days(0) == "inactive"
    assert PersonalizationService._retention_status_from_active_days(1) == "low"
    assert PersonalizationService._retention_status_from_active_days(2) == "medium"
    assert PersonalizationService._retention_status_from_active_days(5) == "high"


def test_count_recent_feature_events_maps_known_types() -> None:
    events = [
        {"event_type": "chat_message_sent"},
        {"event_type": "chat_message_stream_requested"},
        {"event_type": "generation_requested"},
        {"event_type": "unknown_event"},
    ]

    counts = PersonalizationService._count_recent_feature_events(events)

    assert counts["chat"] == 2
    assert counts["generation"] == 1
    assert "unknown_event" not in counts


def test_build_feature_affinity_prioritizes_recent_usage() -> None:
    base_counts = {
        "materials": 10,
        "chat": 4,
    }
    recent_counts = {
        "chat": 5,
        "materials": 1,
    }

    affinity = PersonalizationService._build_feature_affinity(base_counts, recent_counts)

    assert affinity[0]["feature"] == "chat"
    assert affinity[0]["score"] >= affinity[1]["score"]
