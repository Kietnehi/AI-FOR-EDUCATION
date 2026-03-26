import json
import threading
import time

from google import genai
from openai import AsyncOpenAI

from app.core.config import settings
from app.core.logging import logger


class LLMClient:
    _shared_openai_client: AsyncOpenAI | None | object = ...
    _shared_openai_extra_headers: dict[str, str] | None = None
    _shared_gemini_clients: list[tuple[str, genai.Client]] | None = None
    _gemini_key_cooldowns: dict[str, float] = {}
    _gemini_cooldown_lock = threading.Lock()
    _gemini_attempt_timeout_ms = 10000
    _gemini_key_cooldown_seconds = 20.0
    _gemini_fast_pass_key_count = 1

    def __init__(self) -> None:
        self.openai_api_key = settings.openai_api_key
        self.openai_model = settings.openai_model
        self.openai_base_url = settings.openai_base_url
        if LLMClient._shared_openai_client is ...:
            LLMClient._shared_openai_client = (
                AsyncOpenAI(api_key=self.openai_api_key, base_url=self.openai_base_url)
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
                        client = genai.Client(
                            api_key=api_key.strip(),
                            http_options=genai.types.HttpOptions(
                                timeout=LLMClient._gemini_attempt_timeout_ms
                            ),
                        )
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
        self.gemini_attempt_timeout_ms = LLMClient._gemini_attempt_timeout_ms
        self.gemini_key_cooldown_seconds = LLMClient._gemini_key_cooldown_seconds

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

    def _looks_like_permanent_gemini_error(self, exc: Exception) -> bool:
        message = str(exc).lower()
        permanent_markers = (
            "400",
            "bad request",
            "invalid argument",
            "unsupported",
            "malformed",
            "unknown field",
            "invalid value",
        )
        return any(marker in message for marker in permanent_markers)

    def _build_gemini_config(self, temperature: float, force_json: bool) -> dict:
        config: dict = {
            "temperature": temperature,
        }
        if force_json:
            config["response_mime_type"] = "application/json"
        return config

    def _call_gemini_generate_content(
        self,
        *,
        client: genai.Client,
        model_name: str,
        contents_part: list,
        config: dict,
    ):
        models_api = client.models
        direct_generate = getattr(models_api, "_generate_content", None)
        if callable(direct_generate):
            return direct_generate(
                model=model_name,
                contents=contents_part,
                config=config,
            )
        return models_api.generate_content(
            model=model_name,
            contents=contents_part,
            config=config,
        )

    def _try_gemini_candidate(
        self,
        *,
        model_name: str,
        model_index: int,
        primary_model: str,
        key_position: int,
        total_keys: int,
        original_key_index: int,
        key_snippet: str,
        client: genai.Client,
        contents_part: list,
        config: dict,
    ) -> str | None:
        started_at = time.perf_counter()
        try:
            logger.info(
                "Calling Gemini model %s with key %s/%s",
                model_name,
                key_position,
                total_keys,
                extra={
                    "model": model_name,
                    "gemini_model_index": model_index,
                    "gemini_key_index": original_key_index,
                    "key_snippet": key_snippet,
                },
            )
            response = self._call_gemini_generate_content(
                client=client,
                model_name=model_name,
                contents_part=contents_part,
                config=config,
            )
            text = getattr(response, "text", None)
            if not text:
                elapsed_ms = round((time.perf_counter() - started_at) * 1000)
                logger.warning(
                    "Gemini model %s returned empty response with key %s/%s after %sms",
                    model_name,
                    key_position,
                    total_keys,
                    elapsed_ms,
                    extra={
                        "model": model_name,
                        "gemini_model_index": model_index,
                        "gemini_key_index": original_key_index,
                        "key_snippet": key_snippet,
                    },
                )
                return None

            candidate_text = text.strip()
            if config.get("response_mime_type") == "application/json":
                try:
                    json.loads(candidate_text)
                except json.JSONDecodeError:
                    elapsed_ms = round((time.perf_counter() - started_at) * 1000)
                    logger.warning(
                        "Gemini model %s returned invalid JSON with key %s/%s after %sms, trying next option",
                        model_name,
                        key_position,
                        total_keys,
                        elapsed_ms,
                        extra={
                            "model": model_name,
                            "gemini_model_index": model_index,
                            "gemini_key_index": original_key_index,
                            "key_snippet": key_snippet,
                        },
                    )
                    return None

            self.last_model_used = model_name
            self.fallback_used = model_name != primary_model
            self.active_gemini_key_index = original_key_index
            self._clear_gemini_key_cooldown(key_snippet)
            elapsed_ms = round((time.perf_counter() - started_at) * 1000)
            logger.info(
                "Gemini generation successful with model %s after %sms",
                model_name,
                elapsed_ms,
                extra={
                    "model": model_name,
                    "gemini_model_index": model_index,
                    "gemini_key_index": original_key_index,
                    "key_snippet": key_snippet,
                    "fallback_applied": self.fallback_used,
                },
            )
            return candidate_text
        except Exception as exc:
            elapsed_ms = round((time.perf_counter() - started_at) * 1000)
            if self._looks_like_retryable_gemini_error(exc):
                self._set_gemini_key_cooldown(key_snippet)
            if self._looks_like_permanent_gemini_error(exc):
                logger.error(
                    "Gemini request is invalid for model %s after %sms: %s",
                    model_name,
                    elapsed_ms,
                    str(exc),
                    extra={
                        "model": model_name,
                        "gemini_model_index": model_index,
                        "gemini_key_index": original_key_index,
                        "error_type": type(exc).__name__,
                        "error_message": str(exc),
                        "key_snippet": key_snippet,
                    },
                )
                raise
            logger.warning(
                "Gemini model %s failed with key %s/%s after %sms: %s",
                model_name,
                key_position,
                total_keys,
                elapsed_ms,
                str(exc),
                extra={
                    "model": model_name,
                    "gemini_model_index": model_index,
                    "gemini_key_index": original_key_index,
                    "error_type": type(exc).__name__,
                    "error_message": str(exc),
                    "key_snippet": key_snippet,
                },
            )
            return None

    def json_response(
        self, system_prompt: str, user_prompt: str, fallback: dict, images: list[str] | None = None
    ) -> dict:
        self.last_model_used = None
        content = self._generate_text(
            system_prompt, user_prompt, temperature=0.4, force_json=True, images=images
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
<<<<<<< HEAD
        try:
            result = self._generate_gemini(
                system_prompt, user_prompt, temperature, force_json, images=images
            )
            if result is not None:
                return result
        except Exception as exc:
            logger.warning(
                "Gemini API failed with exception: %s",
                exc,
            )
            
        # Fallback to OpenAI if Gemini returns None or hits an exception
        logger.warning(
            "Gemini returned None or failed, fallback to OpenAI model %s",
=======
        result = self._generate_gemini(
            system_prompt, user_prompt, temperature, force_json, images=images
        )
        if result is not None:
            return result

        logger.warning(
            "All Gemini models failed, falling back to OpenAI model %s",
>>>>>>> 932f4c1de8ae5b9998da0046f0bc12ee8cd8fa75
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
        if total_keys == 0:
            logger.error("No Gemini clients available. Check GEMINI_API_KEYS.")
            return None

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

        config = self._build_gemini_config(temperature, force_json)
        fast_pass_clients = ordered_clients[: LLMClient._gemini_fast_pass_key_count]
        exhaustive_pass_clients = ordered_clients[
            LLMClient._gemini_fast_pass_key_count :
        ]

        logger.info(
            "Starting Gemini fast pass",
            extra={
                "models": gemini_models,
                "fast_pass_keys": len(fast_pass_clients),
                "remaining_keys": len(exhaustive_pass_clients),
                "timeout_ms": self.gemini_attempt_timeout_ms,
            },
        )

        try:
            for model_index, model_name in enumerate(gemini_models):
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
                        "is_fallback_model": model_name != primary_model,
                        "attempt_phase": "fast-pass",
                    },
                )

                for key_order, (original_key_index, key_snippet, client) in enumerate(
                    fast_pass_clients,
                    start=1,
                ):
                    result = self._try_gemini_candidate(
                        model_name=model_name,
                        model_index=model_index,
                        primary_model=primary_model,
                        key_position=key_order,
                        total_keys=total_keys,
                        original_key_index=original_key_index,
                        key_snippet=key_snippet,
                        client=client,
                        contents_part=contents_part,
                        config=config,
                    )
                    if result is not None:
                        return result

            if exhaustive_pass_clients:
                logger.info(
                    "Starting Gemini exhaustive pass",
                    extra={
                        "models": gemini_models,
                        "remaining_keys": len(exhaustive_pass_clients),
                        "timeout_ms": self.gemini_attempt_timeout_ms,
                    },
                )

            for model_index, model_name in enumerate(gemini_models):
                if not exhaustive_pass_clients:
                    break
                logger.info(
                    "Exhaustive retry for Gemini model %s (%s/%s)",
                    model_name,
                    model_index + 1,
                    total_models,
                    extra={
                        "model": model_name,
                        "temperature": temperature,
                        "force_json": force_json,
                        "has_images": bool(images),
                        "is_fallback_model": model_name != primary_model,
                        "attempt_phase": "exhaustive-pass",
                    },
                )

                for key_order, (original_key_index, key_snippet, client) in enumerate(
                    exhaustive_pass_clients,
                    start=LLMClient._gemini_fast_pass_key_count + 1,
                ):
                    result = self._try_gemini_candidate(
                        model_name=model_name,
                        model_index=model_index,
                        primary_model=primary_model,
                        key_position=key_order,
                        total_keys=total_keys,
                        original_key_index=original_key_index,
                        key_snippet=key_snippet,
                        client=client,
                        contents_part=contents_part,
                        config=config,
                    )
                    if result is not None:
                        return result
        except Exception as exc:
            if self._looks_like_permanent_gemini_error(exc):
                logger.error(
                    "Gemini sweep aborted due to permanent request error",
                    extra={
                        "error_type": type(exc).__name__,
                        "error_message": str(exc),
                        "timeout_ms": self.gemini_attempt_timeout_ms,
                    },
                )
                return None
            raise

        logger.error(
            "All Gemini models and keys failed",
            extra={
                "total_models": total_models,
                "total_keys": total_keys,
                "timeout_ms": self.gemini_attempt_timeout_ms,
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
