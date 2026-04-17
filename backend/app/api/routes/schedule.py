import shutil
from pathlib import Path
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from motor.motor_asyncio import AsyncIOMotorDatabase
from app.api.dependencies import get_database, get_current_user
from app.schemas.auth import AuthUser
from app.schemas.schedule import (
    ScheduleResponse,
    ScheduleUploadResponse,
    ScheduleEventCreate
)
from app.services.schedule_service import ScheduleService
from app.repositories.schedule_repository import ScheduleRepository
from app.core.config import settings
import os

router = APIRouter()

@router.post("/schedule/upload", response_model=ScheduleUploadResponse)
async def upload_schedule_file(
    file: UploadFile = File(...),
    user: AuthUser = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database),
):
    repo = ScheduleRepository(db)
    service = ScheduleService(repo)
    
    # Save temporary file
    temp_dir = Path(settings.upload_dir) / "temp_schedules"
    temp_dir.mkdir(parents=True, exist_ok=True)
    file_path = temp_dir / file.filename
    
    with open(file_path, "wb") as f:
        shutil.copyfileobj(file.file, f)
    
    try:
        ext = Path(file.filename).suffix.lower()
        extracted_text = ""
        
        if ext in [".jpg", ".jpeg", ".png"]:
            extracted_text = await service.extract_text_from_image(file_path)
        elif ext == ".pdf":
            extracted_text = await service.extract_text_from_pdf(file_path)
        elif ext in [".xlsx", ".xls"]:
            extracted_text = await service.extract_text_from_excel(file_path)
        else:
            raise HTTPException(status_code=400, detail="Định dạng file không hỗ trợ. Vui lòng upload PDF, Excel hoặc Hình ảnh.")
        
        result = await service.parse_schedule_with_ai(extracted_text)
        
        return ScheduleUploadResponse(
            extracted_text=extracted_text,
            events=[ScheduleEventCreate(**e) for e in result.get("events", [])],
            is_valid_schedule=result.get("is_valid", True),
            message=result.get("message")
        )
    finally:
        # Cleanup temp file
        if file_path.exists():
            os.remove(file_path)

from datetime import datetime

@router.get("/schedule", response_model=ScheduleResponse)
async def get_schedule(
    user: AuthUser = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database),
):
    repo = ScheduleRepository(db)
    schedule = await repo.get_for_user(user.id)
    if not schedule:
        now = datetime.utcnow()
        return ScheduleResponse(
            id="none",
            user_id=user.id,
            events=[],
            created_at=now,
            updated_at=now
        )
    return ScheduleResponse(**schedule)

@router.post("/schedule", response_model=ScheduleResponse)
async def save_schedule(
    events: list[ScheduleEventCreate],
    user: AuthUser = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database),
):
    repo = ScheduleRepository(db)
    # Convert Pydantic models to dicts
    events_data = [e.model_dump() for e in events]
    schedule = await repo.create_or_update(user.id, events_data)
    return ScheduleResponse(**schedule)
