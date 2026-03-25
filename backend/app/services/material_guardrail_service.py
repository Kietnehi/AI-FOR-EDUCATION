from __future__ import annotations

from dataclasses import dataclass

from fastapi import HTTPException

from app.ai.generation.llm_client import LLMClient
from app.ai.ingestion.text_cleaner import TextCleaner
from app.core.config import settings


@dataclass
class GuardrailDecision:
    is_academic: bool
    category: str
    reason: str


class MaterialGuardrailService:
    def __init__(self) -> None:
        self.llm = LLMClient()

    def evaluate(
        self,
        *,
        raw_text: str,
        title: str | None = None,
        subject: str | None = None,
        description: str | None = None,
        source_name: str | None = None,
    ) -> GuardrailDecision:
        cleaned_text = TextCleaner.clean(raw_text or "")
        excerpt = cleaned_text[: settings.material_guardrail_excerpt_chars]

        if len(excerpt.strip()) < 80:
            return GuardrailDecision(
                is_academic=False,
                category="insufficient_content",
                reason="Không đủ nội dung để xác minh đây là tài liệu học thuật.",
            )

        fallback = {
            "is_academic": False,
            "category": "verification_unavailable",
            "reason": "Không thể xác minh tài liệu bằng AI guardrail lúc này.",
        }
        system_prompt = (
            "You are an academic document guardrail for an education platform. "
            "Allow only documents whose primary purpose is academic or educational, such as textbooks, "
            "lecture notes, syllabi, research papers, lab guides, academic reports, exercises, study guides, "
            "or other classroom/research materials. Reject pornographic, sexually explicit, illegal, hateful, "
            "violent-extremist, scam, malware, criminal-instruction, gambling, irrelevant entertainment, spam, "
            "or obviously non-academic documents. If the document is mixed, reject unless the dominant purpose is "
            "clearly academic and safe. Return strict JSON only with keys is_academic, category, reason. "
            "The reason must be written in natural Vietnamese with correct diacritics. Keep reason under 30 words."
        )
        user_prompt = (
            f"Title: {title or ''}\n"
            f"Subject: {subject or ''}\n"
            f"Description: {description or ''}\n"
            f"Source name: {source_name or ''}\n\n"
            f"Document excerpt:\n{excerpt}"
        )
        if settings.openai_api_key:
            result = self.llm.json_response_openai(
                system_prompt,
                user_prompt,
                fallback,
                model=settings.openai_guardrail_model,
            )
        else:
            result = self.llm.json_response(system_prompt, user_prompt, fallback)
        return GuardrailDecision(
            is_academic=bool(result.get("is_academic")),
            category=str(result.get("category") or "unknown"),
            reason=str(result.get("reason") or "Tài liệu không đạt guardrail học thuật."),
        )

    def assert_allowed(self, **kwargs: str | None) -> GuardrailDecision:
        decision = self.evaluate(**kwargs)
        if decision.is_academic:
            return decision

        status_code = 503 if decision.category == "verification_unavailable" else 422
        raise HTTPException(
            status_code=status_code,
            detail={
                "code": "material_guardrail_rejected",
                "category": decision.category,
                "message": decision.reason,
            },
        )
