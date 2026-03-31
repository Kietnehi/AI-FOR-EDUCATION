import asyncio
import smtplib
from email.message import EmailMessage

from app.core.config import settings
from app.schemas.contact import CooperationContactRequest


class ContactDeliveryError(Exception):
    """Raised when the cooperation contact email cannot be sent."""


def _send_email_sync(payload: CooperationContactRequest) -> None:
    if not settings.smtp_host or not settings.smtp_user or not settings.smtp_pass:
        raise ContactDeliveryError("Cấu hình SMTP chưa đầy đủ.")
    if not settings.contact_recipient_email:
        raise ContactDeliveryError("Chưa cấu hình email nhận liên hệ.")

    message = EmailMessage()
    message["Subject"] = payload.subject
    message["From"] = settings.smtp_user
    message["To"] = settings.contact_recipient_email
    message["Reply-To"] = payload.email
    message.set_content(
        "\n".join(
            [
                "Bạn vừa nhận được một liên hệ hợp tác mới từ website.",
                "",
                f"Họ tên: {payload.name}",
                f"Email người gửi: {payload.email}",
                f"Chủ đề: {payload.subject}",
                "",
                "Nội dung:",
                payload.message,
            ]
        )
    )

    try:
        with smtplib.SMTP_SSL(settings.smtp_host, settings.smtp_port, timeout=15) as server:
            server.login(settings.smtp_user, settings.smtp_pass)
            server.send_message(message)
    except smtplib.SMTPException as exc:
        raise ContactDeliveryError("Không thể gửi email liên hệ lúc này.") from exc


async def send_cooperation_contact_email(payload: CooperationContactRequest) -> None:
    await asyncio.to_thread(_send_email_sync, payload)
