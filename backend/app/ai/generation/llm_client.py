import json

from google import genai
from openai import OpenAI

from app.core.config import settings
from app.core.logging import logger


class LLMClient:
    def __init__(self) -> None:
        self.openai_api_key = settings.openai_api_key
        self.openai_model = settings.openai_model
        self.openai_base_url = settings.openai_base_url
        self.openai_client = (
            OpenAI(api_key=self.openai_api_key, base_url=self.openai_base_url)
            if self.openai_api_key
            else None
        )
        self.openai_extra_headers: dict[str, str] = {}
        if settings.openrouter_site_url:
            self.openai_extra_headers["HTTP-Referer"] = settings.openrouter_site_url
        if settings.openrouter_site_name:
            self.openai_extra_headers["X-OpenRouter-Title"] = (
                settings.openrouter_site_name
            )

        self.gemini_model = settings.gemini_model
        # Initialize multiple Gemini clients from the list of API keys
        self.gemini_clients: list[tuple[str, genai.Client]] = []
        for api_key in settings.gemini_api_keys:
            if api_key and api_key.strip():
                try:
                    client = genai.Client(api_key=api_key.strip())
                    self.gemini_clients.append((api_key.strip()[:10] + "...", client))
                except Exception as e:
                    logger.warning(
                        f"Failed to initialize Gemini client with key {api_key[:10]}...: {e}"
                    )

        self.last_model_used: str | None = None
        self.fallback_used: bool = False
        self.active_gemini_key_index: int = 0

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

        # Try each Gemini client in order until one succeeds
        last_exception = None
        for idx, (key_snippet, client) in enumerate(self.gemini_clients):
            try:
                logger.info(
                    f"Attempting Gemini generation with key {idx + 1}/{len(self.gemini_clients)} (key: {key_snippet})",
                    extra={
                        "model": self.gemini_model,
                        "temperature": temperature,
                        "force_json": force_json,
                        "has_images": bool(images),
                        "gemini_key_index": idx,
                    },
                )

                config = {
                    "temperature": temperature,
                }
                if force_json:
                    config["response_mime_type"] = "application/json"

                contents_part = []
                contents_part.append(
                    f"System instruction:\n{system_prompt}\n\nUser request:\n{user_prompt}"
                )
                if images:
                    import base64

                    for img in images:
                        if img.startswith("data:"):
                            # Extract Data URIs like "data:image/jpeg;base64,...""
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

                response = client.models.generate_content(
                    model=self.gemini_model,
                    contents=contents_part,
                    config=config,
                )
                text = getattr(response, "text", None)
                if text:
                    self.last_model_used = self.gemini_model
                    self.active_gemini_key_index = idx
                    logger.info(
                        "Gemini generation successful",
                        extra={
                            "model": self.gemini_model,
                            "gemini_key_index": idx,
                            "key_snippet": key_snippet,
                        },
                    )
                    return text.strip()
                else:
                    logger.warning(f"Gemini key {idx + 1} returned empty response")
                    continue

            except Exception as exc:
                last_exception = exc
                logger.warning(
                    f"Gemini key {idx + 1} failed, trying next key...",
                    extra={
                        "model": self.gemini_model,
                        "gemini_key_index": idx,
                        "error_type": type(exc).__name__,
                        "error_message": str(exc),
                        "key_snippet": key_snippet,
                    },
                    exc_info=True,
                )
                continue

        # All Gemini keys failed
        logger.error(
            "All Gemini API keys failed",
            extra={
                "total_keys": len(self.gemini_clients),
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
