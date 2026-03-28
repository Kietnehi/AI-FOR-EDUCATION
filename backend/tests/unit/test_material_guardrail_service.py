from __future__ import annotations

import pytest
from fastapi import HTTPException

from app.services.material_guardrail_service import (
    GuardrailDecision,
    MaterialGuardrailService,
)


class StubLLM:
    def __init__(self) -> None:
        self.calls: list[tuple[str, tuple, dict]] = []

    def json_response(self, *args, **kwargs):
        self.calls.append(("gemini", args, kwargs))
        return {
            "is_academic": True,
            "category": "lecture_notes",
            "reason": "Tai lieu hoc tap hop le.",
        }

    def json_response_openai(self, *args, **kwargs):
        self.calls.append(("openai", args, kwargs))
        return {
            "is_academic": False,
            "category": "verification_unavailable",
            "reason": "Guardrail tam thoi khong kha dung.",
        }


def test_evaluate_returns_insufficient_content_without_calling_llm() -> None:
    service = MaterialGuardrailService()
    service.llm = StubLLM()

    decision = service.evaluate(raw_text="Qua ngan de danh gia")

    assert decision == GuardrailDecision(
        is_academic=False,
        category="insufficient_content",
        reason="Không đủ nội dung để xác minh đây là tài liệu học thuật.",
    )
    assert service.llm.calls == []


def test_evaluate_uses_default_llm_path_when_openai_key_is_empty(monkeypatch) -> None:
    service = MaterialGuardrailService()
    stub = StubLLM()
    service.llm = stub
    monkeypatch.setattr(
        "app.services.material_guardrail_service.settings.openai_api_key", ""
    )
    monkeypatch.setattr(
        "app.services.material_guardrail_service.settings.material_guardrail_excerpt_chars",
        90,
    )

    decision = service.evaluate(
        raw_text="Tai lieu hoc thuat " * 20,
        title="Bai giang AI",
        subject="Tri tue nhan tao",
        description="Gioi thieu chuong 1",
        source_name="slides.pdf",
    )

    assert decision.is_academic is True
    assert decision.category == "lecture_notes"
    assert len(stub.calls) == 1
    call_type, args, kwargs = stub.calls[0]
    assert call_type == "gemini"
    assert "Title: Bai giang AI" in args[1]
    assert "Subject: Tri tue nhan tao" in args[1]
    assert "Source name: slides.pdf" in args[1]
    assert kwargs == {}


def test_evaluate_uses_openai_guardrail_when_key_exists(monkeypatch) -> None:
    service = MaterialGuardrailService()
    stub = StubLLM()
    service.llm = stub
    monkeypatch.setattr(
        "app.services.material_guardrail_service.settings.openai_api_key", "secret"
    )
    monkeypatch.setattr(
        "app.services.material_guardrail_service.settings.openai_guardrail_model",
        "guard-model",
    )
    monkeypatch.setattr(
        "app.services.material_guardrail_service.settings.material_guardrail_excerpt_chars",
        85,
    )

    decision = service.evaluate(raw_text="Noi dung hoc thuat " * 20)

    assert decision.category == "verification_unavailable"
    assert len(stub.calls) == 1
    call_type, args, kwargs = stub.calls[0]
    assert call_type == "openai"
    assert kwargs == {"model": "guard-model"}
    assert args[2]["category"] == "verification_unavailable"


def test_assert_allowed_returns_decision_for_academic_content(monkeypatch) -> None:
    service = MaterialGuardrailService()
    monkeypatch.setattr(
        service,
        "evaluate",
        lambda **_: GuardrailDecision(True, "textbook", "Tai lieu hop le."),
    )

    decision = service.assert_allowed(raw_text="anything")

    assert decision.is_academic is True
    assert decision.category == "textbook"


@pytest.mark.parametrize(
    ("category", "expected_status"),
    [("unsafe_content", 422), ("verification_unavailable", 503)],
)
def test_assert_allowed_raises_http_exception_for_rejected_content(
    category: str, expected_status: int, monkeypatch
) -> None:
    service = MaterialGuardrailService()
    monkeypatch.setattr(
        service,
        "evaluate",
        lambda **_: GuardrailDecision(False, category, "Bi tu choi."),
    )

    with pytest.raises(HTTPException) as exc_info:
        service.assert_allowed(raw_text="anything")

    assert exc_info.value.status_code == expected_status
    assert exc_info.value.detail == {
        "code": "material_guardrail_rejected",
        "category": category,
        "message": "Bi tu choi.",
    }
