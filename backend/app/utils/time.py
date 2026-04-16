from datetime import datetime, timezone
from zoneinfo import ZoneInfo

VIETNAM_TZ = ZoneInfo("Asia/Ho_Chi_Minh")


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def vietnam_now() -> datetime:
    return datetime.now(VIETNAM_TZ)


def parse_vietnam_datetime(value: str) -> datetime:
    parsed = datetime.fromisoformat(value)
    if parsed.tzinfo is None:
        return parsed.replace(tzinfo=VIETNAM_TZ)
    return parsed.astimezone(VIETNAM_TZ)
