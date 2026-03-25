import json
import threading
import time
from concurrent.futures import ThreadPoolExecutor, TimeoutError as FutureTimeoutError

from google import genai
from openai import OpenAI

from app.core.config import settings
from app.core.logging import logger


class LLMClient:
    _shared_openai_client: OpenAI | None | object = ...
    _shared_openai_extra_headers: dict[str, str] | None = None
    _shared_gemini_clients: list[tuple[str, genai.Client]] | None = None
    _gemini_executor = ThreadPoolExecutor(max_workers=8)
    _gemini_key_cooldowns: dict[str, float] = {}
    _gemini_cooldown_lock = threading.Lock()

    def __init__(self) -> None:
        self.openai_api_key = settings.openai_api_key
        self.openai_model = settings.openai_model
        self.openai_base_url = settings.openai_base_url
        if LLMClient._shared_openai_client is ...:
            LLMClient._shared_openai_client = (
                OpenAI(api_key=self.openai_api_key, base_url=self.openai_base_url)
                if self.openai_api_key
                else None
            )
        self.openai_client = (
            None
            if LLMClient._shared_openai_client is ...
            else LLMClient._shared_openai_client
        )
        if LLMClient._shared_openai_extra_headers is None:
            extra_headers: dict[str, str] = {}
            if settings.openrouter_site_url:
                extra_headers["HTTP-Referer"] = settings.openrouter_site_url
            if settings.openrouter_site_name:
                extra_headers["X-OpenRouter-Title"] = settings.openrouter_site_name
            LLMClient._shared_openai_extra_headers = extra_headers
        self.openai_extra_headers = dict(LLMClient._shared_openai_extra_headers)

        self.gemini_model = settings.gemini_model
        self.gemini_fallback_models = [
            "gemini-3.1-flash-lite-preview",
            "gemini-2.5-pro",
            "gemini-2.5-flash",
            "gemini-2.5-flash-lite",
        ]
        if LLMClient._shared_gemini_clients is None:
            gemini_clients: list[tuple[str, genai.Client]] = []
            for api_key in settings.gemini_api_keys:
                if api_key and api_key.strip():
                    try:
                        client = genai.Client(api_key=api_key.strip())
                        gemini_clients.append((api_key.strip()[:10] + "...", client))
                    except Exception as e:
                        logger.warning(
                            f"Failed to initialize Gemini client with key {api_key[:10]}...: {e}"
                        )
            LLMClient._shared_gemini_clients = gemini_clients
        self.gemini_clients = list(LLMClient._shared_gemini_clients)

        self.last_model_used: str | None = None
        self.fallback_used: bool = False
        self.active_gemini_key_index: int = 0
        self.gemini_attempt_timeout_seconds = 12.0
        self.gemini_key_cooldown_seconds = 20.0

    def _ordered_gemini_models(self) -> list[str]:
        ordered_models = [self.gemini_model, *self.gemini_fallback_models]
        deduped_models: list[str] = []
        for model in ordered_models:
            if model and model not in deduped_models:
                deduped_models.append(model)
        return deduped_models

    def _ordered_gemini_clients(self) -> list[tuple[int, str, genai.Client]]:
        total_keys = len(self.gemini_clients)
        if total_keys == 0:
            return []

        start_index = self.active_gemini_key_index % total_keys
        rotated_clients = [
            (original_index, *self.gemini_clients[original_index])
            for original_index in (
                list(range(start_index, total_keys)) + list(range(0, start_index))
            )
        ]
        now = time.monotonic()
        ready_clients: list[tuple[int, str, genai.Client]] = []
        cooling_clients: list[tuple[int, str, genai.Client]] = []

        with LLMClient._gemini_cooldown_lock:
            for original_index, key_snippet, client in rotated_clients:
                retry_after = LLMClient._gemini_key_cooldowns.get(key_snippet, 0.0)
                if retry_after > now:
                    cooling_clients.append((original_index, key_snippet, client))
                else:
                    ready_clients.append((original_index, key_snippet, client))

        return ready_clients + cooling_clients

    def _set_gemini_key_cooldown(self, key_snippet: str) -> None:
        with LLMClient._gemini_cooldown_lock:
            LLMClient._gemini_key_cooldowns[key_snippet] = (
                time.monotonic() + self.gemini_key_cooldown_seconds
            )

    def _clear_gemini_key_cooldown(self, key_snippet: str) -> None:
        with LLMClient._gemini_cooldown_lock:
            LLMClient._gemini_key_cooldowns.pop(key_snippet, None)

    def _call_gemini_with_timeout(
        self,
        client: genai.Client,
        model_name: str,
        contents_part: list,
        config: dict,
    ):
        future = LLMClient._gemini_executor.submit(
            client.models.generate_content,
            model=model_name,
            contents=contents_part,
            config=config,
        )
        try:
            return future.result(timeout=self.gemini_attempt_timeout_seconds)
        except FutureTimeoutError as exc:
            future.cancel()
            raise TimeoutError(
                f"Gemini call timed out after {self.gemini_attempt_timeout_seconds:.0f}s"
            ) from exc

    def _looks_like_retryable_gemini_error(self, exc: Exception) -> bool:
        message = str(exc).lower()
        retryable_markers = (
            "timeout",
            "timed out",
            "deadline",
            "temporarily unavailable",
            "rate limit",
            "429",
            "503",
            "connection",
            "unavailable",
            "internal error",
            "resource exhausted",
        )
        return any(marker in message for marker in retryable_markers)

    def json_response(
        self, system_prompt: str, user_prompt: str, fallback: dict
    ) -> dict:
        self.last_model_used = None
        content = self._generate_text(
            system_prompt, user_prompt, temperature=0.4, force_json=True
        )
        if not content:
            return fallback
        try:
            return json.loads(content)
        except json.JSONDecodeError:
            return fallback

    def text_response(
        self,
        system_prompt: str,
        user_prompt: str,
        fallback: str,
        images: list[str] | None = None,
    ) -> str:
        self.last_model_used = None
        content = self._generate_text(
            system_prompt, user_prompt, temperature=0.3, force_json=False, images=images
        )
        return content or fallback

    def text_response_openai(
        self,
        system_prompt: str,
        user_prompt: str,
        fallback: str,
        model: str | None = None,
        images: list[str] | None = None,
    ) -> str:
        content = self._generate_openai(
            system_prompt,
            user_prompt,
            temperature=0.3,
            force_json=False,
            model=model,
            images=images,
        )
        return content or fallback

    def json_response_openai(
        self,
        system_prompt: str,
        user_prompt: str,
        fallback: dict,
        model: str | None = None,
    ) -> dict:
        content = self._generate_openai(
            system_prompt, user_prompt, temperature=0.1, force_json=True, model=model
        )
        if not content:
            return fallback
        try:
            return json.loads(content)
        except json.JSONDecodeError:
            return fallback

    def _generate_text(
        self,
        system_prompt: str,
        user_prompt: str,
        temperature: float,
        force_json: bool,
        images: list[str] | None = None,
    ) -> str | None:
        self.last_model_used = None
        self.fallback_used = False
        result = self._generate_gemini(
            system_prompt, user_prompt, temperature, force_json, images=images
        )
        if result is not None:
            return result

        logger.warning(
            "All Gemini models failed, falling back to OpenAI model %s",
            self.openai_model,
        )
        self.fallback_used = True
        return self._generate_openai(
            system_prompt, user_prompt, temperature, force_json, images=images
        )

    def _generate_gemini(
        self,
        system_prompt: str,
        user_prompt: str,
        temperature: float,
        force_json: bool,
        images: list[str] | None = None,
    ) -> str | None:
        if not self.gemini_clients:
            logger.error("No Gemini clients initialized. Check GEMINI_API_KEYS.")
            return None

        gemini_models = self._ordered_gemini_models()
        primary_model = gemini_models[0]
        total_models = len(gemini_models)
        ordered_clients = self._ordered_gemini_clients()
        total_keys = len(ordered_clients)
        last_exception = None

        contents_part = [
            f"System instruction:\n{system_prompt}\n\nUser request:\n{user_prompt}"
        ]
        if images:
            import base64

            for img in images:
                if img.startswith("data:"):
                    comma_idx = img.find(",")
                    if comma_idx != -1:
                        mime_type = img[5 : img.find(";")]
                        b64_data = img[comma_idx + 1 :]
                        if b64_data:
                            contents_part.append(
                                genai.types.Part.from_bytes(
                                    data=base64.b64decode(b64_data),
                                    mime_type=mime_type,
                                )
                            )
                else:
                    contents_part.append(
                        genai.types.Part.from_bytes(
                            data=base64.b64decode(img), mime_type="image/jpeg"
                        )
                    )

        for model_index, model_name in enumerate(gemini_models):
            is_fallback_model = model_name != primary_model
            logger.info(
                "Trying Gemini model %s (%s/%s)",
                model_name,
                model_index + 1,
                total_models,
                extra={
                    "model": model_name,
                    "temperature": temperature,
                    "force_json": force_json,
                    "has_images": bool(images),
                    "is_fallback_model": is_fallback_model,
                },
            )

            for key_order, (original_key_index, key_snippet, client) in enumerate(
                ordered_clients
            ):
                try:
                    logger.info(
                        "Calling Gemini model %s with key %s/%s",
                        model_name,
                        key_order + 1,
                        total_keys,
                        extra={
                            "model": model_name,
                            "gemini_model_index": model_index,
                            "gemini_key_index": original_key_index,
                            "key_snippet": key_snippet,
                        },
                    )

                    config = {
                        "temperature": temperature,
                    }
                    if force_json:
                        config["response_mime_type"] = "application/json"

                    response = self._call_gemini_with_timeout(
                        client=client,
                        model_name=model_name,
                        contents_part=contents_part,
                        config=config,
                    )
                    text = getattr(response, "text", None)
                    if text:
                        candidate_text = text.strip()
                        if force_json:
                            try:
                                json.loads(candidate_text)
                            except json.JSONDecodeError as exc:
                                last_exception = exc
                                logger.warning(
                                    "Gemini model %s returned invalid JSON with key %s/%s, trying next option",
                                    model_name,
                                    key_order + 1,
                                    total_keys,
                                    extra={
                                        "model": model_name,
                                        "gemini_model_index": model_index,
                                        "gemini_key_index": original_key_index,
                                        "key_snippet": key_snippet,
                                    },
                                )
                                continue

                        self.last_model_used = model_name
                        self.fallback_used = is_fallback_model
                        self.active_gemini_key_index = original_key_index
                        self._clear_gemini_key_cooldown(key_snippet)
                        logger.info(
                            "Gemini generation successful with model %s",
                            model_name,
                            extra={
                                "model": model_name,
                                "gemini_model_index": model_index,
                                "gemini_key_index": original_key_index,
                                "key_snippet": key_snippet,
                                "fallback_applied": self.fallback_used,
                            },
                        )
                        return candidate_text

                    logger.warning(
                        "Gemini model %s returned empty response with key %s/%s",
                        model_name,
                        key_order + 1,
                        total_keys,
                        extra={
                            "model": model_name,
                            "gemini_model_index": model_index,
                            "gemini_key_index": original_key_index,
                            "key_snippet": key_snippet,
                        },
                    )
                except Exception as exc:
                    last_exception = exc
                    if self._looks_like_retryable_gemini_error(exc):
                        self._set_gemini_key_cooldown(key_snippet)
                    logger.warning(
                        "Gemini model %s failed with key %s/%s, trying next option",
                        model_name,
                        key_order + 1,
                        total_keys,
                        extra={
                            "model": model_name,
                            "gemini_model_index": model_index,
                            "gemini_key_index": original_key_index,
                            "error_type": type(exc).__name__,
                            "error_message": str(exc),
                            "key_snippet": key_snippet,
                        },
                    )

        logger.error(
            "All Gemini models and keys failed",
            extra={
                "total_models": total_models,
                "total_keys": total_keys,
                "last_error": str(last_exception)
                if last_exception
                else "Unknown error",
            },
        )
        return None

    def _generate_openai(
        self,
        system_prompt: str,
        user_prompt: str,
        temperature: float,
        force_json: bool,
        model: str | None = None,
        images: list[str] | None = None,
    ) -> str | None:
        if not self.openai_client:
            logger.error("OpenAI client not initialized. Check OPENAI_API_KEY.")
            return None

        logger.info(
            "Attempting OpenAI generation",
            extra={
                "model": model or self.openai_model,
                "temperature": temperature,
                "force_json": force_json,
                "has_images": bool(images),
                "is_fallback": self.fallback_used
                if hasattr(self, "fallback_used")
                else False,
            },
        )

        if images:
            user_content = [{"type": "text", "text": user_prompt}]
            for img in images:
                if img.startswith("data:"):
                    user_content.append(
                        {"type": "image_url", "image_url": {"url": img}}
                    )
                else:
                    user_content.append(
                        {
                            "type": "image_url",
                            "image_url": {"url": f"data:image/jpeg;base64,{img}"},
                        }
                    )
        else:
            user_content = user_prompt

        request_payload = {
            "model": model or self.openai_model,
            "temperature": temperature,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_content},
            ],
        }
        if force_json:
            request_payload["response_format"] = {"type": "json_object"}
        if self.openai_extra_headers:
            request_payload["extra_headers"] = self.openai_extra_headers

        try:
            response = self.openai_client.chat.completions.create(**request_payload)
            content = response.choices[0].message.content
            if content:
                self.last_model_used = model or self.openai_model
                logger.info(
                    "OpenAI generation successful",
                    extra={
                        "model": model or self.openai_model,
                        "finish_reason": getattr(
                            response.choices[0], "finish_reason", None
                        ),
                    },
                )
                return content.strip()
            else:
                logger.warning("OpenAI returned empty response")
                return None
        except Exception as exc:
            logger.error(
                "OpenAI API call failed",
                extra={
                    "model": model or self.openai_model,
                    "error_type": type(exc).__name__,
                    "error_message": str(exc),
                },
                exc_info=True,
            )
            raise
