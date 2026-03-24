import json

import google.generativeai as genai
from openai import OpenAI

from app.core.config import settings


class LLMClient:
    def __init__(self) -> None:
        self.provider = settings.llm_provider.lower().strip()

        self.openai_api_key = settings.openai_api_key
        self.openai_model = settings.openai_model
        self.openai_base_url = settings.openai_base_url
        self.openai_client = (
            OpenAI(api_key=self.openai_api_key, base_url=self.openai_base_url) if self.openai_api_key else None
        )
        self.openai_extra_headers: dict[str, str] = {}
        if settings.openrouter_site_url:
            self.openai_extra_headers["HTTP-Referer"] = settings.openrouter_site_url
        if settings.openrouter_site_name:
            self.openai_extra_headers["X-OpenRouter-Title"] = settings.openrouter_site_name

        self.gemini_api_key = settings.gemini_api_key
        self.gemini_model = settings.gemini_model
        if self.gemini_api_key:
            genai.configure(api_key=self.gemini_api_key)

    def json_response(self, system_prompt: str, user_prompt: str, fallback: dict) -> dict:
        content = self._generate_text(system_prompt, user_prompt, temperature=0.4, force_json=True)
        if not content:
            return fallback
        try:
            return json.loads(content)
        except json.JSONDecodeError:
            return fallback

    def text_response(self, system_prompt: str, user_prompt: str, fallback: str) -> str:
        content = self._generate_text(system_prompt, user_prompt, temperature=0.3, force_json=False)
        return content or fallback

    def _generate_text(
        self,
        system_prompt: str,
        user_prompt: str,
        temperature: float,
        force_json: bool,
    ) -> str | None:
        if self.provider == "gemini":
            result = self._generate_gemini(system_prompt, user_prompt, temperature, force_json)
            if result is not None:
                return result
            return self._generate_openai(system_prompt, user_prompt, temperature, force_json)

        if self.provider == "openai":
            result = self._generate_openai(system_prompt, user_prompt, temperature, force_json)
            if result is not None:
                return result
            return self._generate_gemini(system_prompt, user_prompt, temperature, force_json)

        # Auto-fallback by availability when provider value is unexpected.
        return self._generate_gemini(system_prompt, user_prompt, temperature, force_json) or self._generate_openai(
            system_prompt,
            user_prompt,
            temperature,
            force_json,
        )

    def _generate_gemini(
        self,
        system_prompt: str,
        user_prompt: str,
        temperature: float,
        force_json: bool,
    ) -> str | None:
        if not self.gemini_api_key:
            return None

        model = genai.GenerativeModel(model_name=self.gemini_model)
        generation_config = {
            "temperature": temperature,
        }
        if force_json:
            generation_config["response_mime_type"] = "application/json"

        response = model.generate_content(
            [
                f"System instruction:\n{system_prompt}",
                f"User request:\n{user_prompt}",
            ],
            generation_config=generation_config,
        )
        text = getattr(response, "text", None)
        return text.strip() if text else None

    def _generate_openai(
        self,
        system_prompt: str,
        user_prompt: str,
        temperature: float,
        force_json: bool,
    ) -> str | None:
        if not self.openai_client:
            return None

        request_payload = {
            "model": self.openai_model,
            "temperature": temperature,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
        }
        if force_json:
            request_payload["response_format"] = {"type": "json_object"}
        if self.openai_extra_headers:
            request_payload["extra_headers"] = self.openai_extra_headers

        response = self.openai_client.chat.completions.create(**request_payload)
        content = response.choices[0].message.content
        return content.strip() if content else None
