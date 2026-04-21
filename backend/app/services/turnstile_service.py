"""Cloudflare Turnstile CAPTCHA verification service."""

import httpx

from app.core.config import settings


TURNSTILE_VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify"


class TurnstileVerificationError(Exception):
    """Raised when Turnstile CAPTCHA verification fails."""


async def verify_turnstile_token(token: str) -> None:
    """
    Verify a Cloudflare Turnstile token with the Turnstile API.

    Raises:
        TurnstileVerificationError: if verification fails or the token is invalid.
    """
    secret_key = settings.turnstile_secret_key.strip()
    token = token.strip()

    # Skip verification in test/development mode when no secret key is configured
    if not secret_key:
        return

    if not token:
        raise TurnstileVerificationError("Thiếu CAPTCHA token. Vui lòng thử lại.")

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.post(
                TURNSTILE_VERIFY_URL,
                data={
                    "secret": secret_key,
                    "response": token,
                },
            )
            if response.status_code >= 400:
                raise TurnstileVerificationError(
                    "Xác minh CAPTCHA thất bại (HTTP "
                    f"{response.status_code}). Kiểm tra TURNSTILE_SECRET_KEY và domain cấu hình trên Cloudflare."
                )
            result = response.json()
    except httpx.HTTPError as exc:
        raise TurnstileVerificationError(
            f"Không thể kết nối tới dịch vụ CAPTCHA: {exc}"
        ) from exc

    if not result.get("success"):
        error_codes = result.get("error-codes", [])
        raise TurnstileVerificationError(
            f"Xác minh CAPTCHA không hợp lệ. Vui lòng thử lại. ({', '.join(error_codes)})"
        )
