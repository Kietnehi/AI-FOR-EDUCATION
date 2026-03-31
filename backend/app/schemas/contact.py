from pydantic import BaseModel, field_validator


class CooperationContactRequest(BaseModel):
    name: str
    email: str
    subject: str = "Liên hệ hợp tác từ website"
    message: str
    captcha_token: str

    @field_validator("name", "subject", "message", "captcha_token")
    @classmethod
    def validate_required_text(cls, value: str) -> str:
        cleaned = value.strip()
        if not cleaned:
            raise ValueError("Trường này là bắt buộc.")
        return cleaned

    @field_validator("email")
    @classmethod
    def validate_email(cls, value: str) -> str:
        cleaned = value.strip()
        if "@" not in cleaned or cleaned.startswith("@") or cleaned.endswith("@"):
            raise ValueError("Email không hợp lệ.")
        return cleaned


class CooperationContactResponse(BaseModel):
    message: str
