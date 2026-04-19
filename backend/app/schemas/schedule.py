from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, ConfigDict

class ScheduleEventBase(BaseModel):
    title: str
    start_time: str
    end_time: str
    location: Optional[str] = None
    notes: Optional[str] = None
    notified: bool = False
    completed: bool = False

class ScheduleEventCreate(ScheduleEventBase):
    pass

class ScheduleEventUpdate(ScheduleEventBase):
    title: Optional[str] = None
    start_time: Optional[str] = None
    end_time: Optional[str] = None
    notified: Optional[bool] = None

class ScheduleEventResponse(ScheduleEventBase):
    id: Optional[str] = None

class ScheduleResponse(BaseModel):
    id: str
    user_id: str
    events: List[ScheduleEventResponse]
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)

class ScheduleUploadResponse(BaseModel):
    extracted_text: str
    events: List[ScheduleEventCreate]
    is_valid_schedule: bool = True
    message: Optional[str] = None
