import asyncio
import smtplib
from email.message import EmailMessage
from typing import List
from app.core.config import settings

class EmailService:
    @staticmethod
    def _send_email_sync(to_email: str, subject: str, body: str) -> None:
        if not settings.smtp_host or not settings.smtp_user or not settings.smtp_pass:
            print("SMTP configuration missing. Cannot send email.")
            return

        message = EmailMessage()
        message["Subject"] = subject
        message["From"] = settings.smtp_user
        message["To"] = to_email
        message.set_content(body)

        try:
            with smtplib.SMTP_SSL(settings.smtp_host, settings.smtp_port, timeout=15) as server:
                server.login(settings.smtp_user, settings.smtp_pass)
                server.send_message(message)
        except smtplib.SMTPException as exc:
            print(f"Failed to send email: {exc}")

    @classmethod
    async def send_email(cls, to_email: str, subject: str, body: str) -> None:
        await asyncio.to_thread(cls._send_email_sync, to_email, subject, body)

    @classmethod
    async def send_event_reminder(cls, to_email: str, event_title: str, start_time: str, location: str = None, notes: str = None, ai_message: str = None) -> None:
        subject = f"🔔 AI Nhắc lịch: {event_title}"
        
        # Build the body using AI message if provided
        if ai_message:
            body = f"""{ai_message}

---
THÔNG TIN CHI TIẾT:
📅 Tiêu đề: {event_title}
⏰ Thời gian: {start_time}
📍 Địa điểm: {location if location else 'Không có'}
📝 Ghi chú: {notes if notes else 'Không có'}
"""
        else:
            body = f"""
Bạn có một sự kiện sắp diễn ra!

Tiêu đề: {event_title}
Thời gian: {start_time}
Địa điểm: {location if location else 'Không có'}
Ghi chú: {notes if notes else 'Không có'}

Chúc bạn có một ngày làm việc và học tập hiệu quả!
"""
        await cls.send_email(to_email, subject, body)
