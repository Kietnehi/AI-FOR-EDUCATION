from datetime import datetime
from typing import TypedDict, List, Optional

class ScheduleEventDoc(TypedDict, total=False):
    title: str
    start_time: str  # ISO format string or datetime
    end_time: str    # ISO format string or datetime
    location: Optional[str]
    notes: Optional[str]
    notified: bool
    created_at: datetime
    updated_at: datetime

class ScheduleDoc(TypedDict, total=False):
    user_id: str
    events: List[ScheduleEventDoc]
    created_at: datetime
    updated_at: datetime
