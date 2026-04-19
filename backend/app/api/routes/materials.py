from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from motor.motor_asyncio import AsyncIOMotorDatabase
from app.api.dependencies import get_database, get_current_user
from app.schemas.auth import AuthUser
from app.schemas.materials import (
    MaterialCreateRequest,
    MaterialGuardrailCheckRequest,
    MaterialGuardrailCheckResponse,
    MaterialListResponse,
    OCRPreviewResponse,
    MaterialProcessRequest,
    MaterialProcessResponse,
    MaterialResponse,
    MaterialShareRequest,
    MaterialUpdateRequest,
)
from app.services.material_service import MaterialService
from app.services.personalization_service import PersonalizationService
from app.services.storage import storage_service

router = APIRouter()


@router.post("/materials", response_model=MaterialResponse)
async def create_material(
    payload: MaterialCreateRequest,
    user: AuthUser = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database),
) -> MaterialResponse:
    service = MaterialService(db)
    material = await service.create_material(payload.model_dump())
    personalization_service = PersonalizationService(db)
    await personalization_service.track_event(
        user_id=user.id,
        event_type="material_created",
        resource_type="material",
        resource_id=material.get("id"),
        metadata={
            "source_type": material.get("source_type"),
            "subject": material.get("subject"),
        },
    )
    if not material.get("storage_type"):
        material["storage_type"] = storage_service.detect_storage_type(material.get("file_url"))
    return MaterialResponse(**material)


@router.post(
    "/materials/guardrail-check", response_model=MaterialGuardrailCheckResponse
)
async def check_material_guardrail(
    payload: MaterialGuardrailCheckRequest,
    user: AuthUser = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database),
) -> MaterialGuardrailCheckResponse:
    service = MaterialService(db)
    result = await service.check_material_guardrail(payload.model_dump())
    return MaterialGuardrailCheckResponse(**result)


@router.post(
    "/materials/guardrail-check-upload", response_model=MaterialGuardrailCheckResponse
)
async def check_upload_guardrail(
    file: UploadFile = File(...),
    user: AuthUser = Depends(get_current_user),
    title: str | None = Form(None),
    description: str | None = Form(None),
    subject: str | None = Form(None),
    education_level: str | None = Form(None),
    tags: str | None = Form(None),
    stt_model: str | None = Form(None),
    whisper_language: str | None = Form(None),
    db: AsyncIOMotorDatabase = Depends(get_database),
) -> MaterialGuardrailCheckResponse:
    service = MaterialService(db)
    result = await service.check_upload_guardrail(
        file=file,
        metadata={
            "title": title,
            "description": description,
            "subject": subject,
            "education_level": education_level,
            "tags": [item.strip() for item in tags.split(",")] if tags else [],
            "stt_model": stt_model,
            "whisper_language": whisper_language,
        },
    )
    return MaterialGuardrailCheckResponse(**result)


@router.post("/materials/ocr-preview-upload", response_model=OCRPreviewResponse)
async def ocr_preview_upload(
    file: UploadFile = File(...),
    user: AuthUser = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database),
) -> OCRPreviewResponse:
    service = MaterialService(db)
    result = await service.preview_image_ocr_upload(file=file)
    return OCRPreviewResponse(**result)


@router.post("/materials/upload", response_model=MaterialResponse)
async def upload_material(
    file: UploadFile = File(...),
    user: AuthUser = Depends(get_current_user),
    title: str | None = Form(None),
    description: str | None = Form(None),
    subject: str | None = Form(None),
    education_level: str | None = Form(None),
    tags: str | None = Form(None),
    stt_model: str | None = Form(None),
    whisper_language: str | None = Form(None),
    db: AsyncIOMotorDatabase = Depends(get_database),
) -> MaterialResponse:
    service = MaterialService(db)
    material = await service.upload_material(
        user_id=user.id,
        file=file,
        metadata={
            "title": title,
            "description": description,
            "subject": subject,
            "education_level": education_level,
            "tags": [item.strip() for item in tags.split(",")] if tags else [],
            "stt_model": stt_model,
            "whisper_language": whisper_language,
        },
    )
    personalization_service = PersonalizationService(db)
    await personalization_service.track_event(
        user_id=user.id,
        event_type="material_uploaded",
        resource_type="material",
        resource_id=material.get("id"),
        metadata={
            "file_name": file.filename,
            "source_type": material.get("source_type"),
            "subject": material.get("subject"),
        },
    )
    if not material.get("storage_type"):
        material["storage_type"] = storage_service.detect_storage_type(material.get("file_url"))
    return MaterialResponse(**material)


@router.get("/materials", response_model=MaterialListResponse)
async def list_materials(
    skip: int = 0,
    limit: int = 20,
    user: AuthUser = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database),
) -> MaterialListResponse:
    service = MaterialService(db)
    items, total = await service.list_materials(user_id=user.id, skip=skip, limit=limit)
    for item in items:
        if not item.get("storage_type"):
            item["storage_type"] = storage_service.detect_storage_type(item.get("file_url"))
    return MaterialListResponse(
        items=[MaterialResponse(**item) for item in items], total=total
    )


@router.get("/materials/{material_id}", response_model=MaterialResponse)
async def get_material(
    material_id: str,
    user: AuthUser = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database),
) -> MaterialResponse:
    service = MaterialService(db)
    material = await service.get_material(material_id, user_id=user.id)
    personalization_service = PersonalizationService(db)
    await personalization_service.track_event(
        user_id=user.id,
        event_type="material_viewed",
        resource_type="material",
        resource_id=material.get("id") or material_id,
    )
    if not material.get("storage_type"):
        material["storage_type"] = storage_service.detect_storage_type(material.get("file_url"))
    return MaterialResponse(**material)


@router.post("/materials/{material_id}/process", response_model=MaterialProcessResponse)
async def process_material(
    material_id: str,
    payload: MaterialProcessRequest,
    user: AuthUser = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database),
) -> MaterialProcessResponse:
    service = MaterialService(db)
    await service.enqueue_process(
        material_id,
        force_reprocess=payload.force_reprocess,
        user_id=user.id,
        chunking_strategy=payload.chunking_strategy,
    )
    personalization_service = PersonalizationService(db)
    await personalization_service.track_event(
        user_id=user.id,
        event_type="material_process_requested",
        resource_type="material",
        resource_id=material_id,
        metadata={"force_reprocess": payload.force_reprocess},
    )
    return MaterialProcessResponse(
        material_id=material_id,
        processing_status="queued",
        message="Processing started in background",
    )


@router.delete("/materials/{material_id}")
async def delete_material(
    material_id: str,
    user: AuthUser = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database),
) -> dict:
    service = MaterialService(db)
    deleted = await service.delete_material(material_id, user_id=user.id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Material not found")
    return {"message": "Material deleted successfully"}


@router.patch("/materials/{material_id}", response_model=MaterialResponse)
async def update_material(
    material_id: str,
    payload: MaterialUpdateRequest,
    user: AuthUser = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database),
) -> MaterialResponse:
    service = MaterialService(db)
    material = await service.update_material(
        material_id=material_id,
        user_id=user.id,
        update_fields=payload.model_dump(exclude_none=True),
    )
    if not material.get("storage_type"):
        material["storage_type"] = storage_service.detect_storage_type(material.get("file_url"))
    return MaterialResponse(**material)


@router.post("/materials/{material_id}/share", response_model=MaterialResponse)
async def share_material(
    material_id: str,
    payload: MaterialShareRequest,
    user: AuthUser = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database),
) -> MaterialResponse:
    service = MaterialService(db)
    material = await service.share_material(
        material_id=material_id, owner_id=user.id, target_email=payload.email
    )
    if not material.get("storage_type"):
        material["storage_type"] = storage_service.detect_storage_type(material.get("file_url"))
    return MaterialResponse(**material)


@router.post("/materials/{material_id}/unshare", response_model=MaterialResponse)
async def unshare_material(
    material_id: str,
    payload: MaterialShareRequest,
    user: AuthUser = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database),
) -> MaterialResponse:
    service = MaterialService(db)
    material = await service.unshare_material(
        material_id=material_id, owner_id=user.id, target_email=payload.email
    )
    if not material.get("storage_type"):
        material["storage_type"] = storage_service.detect_storage_type(material.get("file_url"))
    return MaterialResponse(**material)
