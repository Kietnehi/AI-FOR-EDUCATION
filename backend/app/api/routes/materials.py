from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.api.dependencies import get_database
from app.schemas.materials import (
    MaterialCreateRequest,
    MaterialGuardrailCheckRequest,
    MaterialGuardrailCheckResponse,
    MaterialListResponse,
    MaterialProcessRequest,
    MaterialProcessResponse,
    MaterialResponse,
)
from app.services.material_service import MaterialService

router = APIRouter()


@router.post("/materials", response_model=MaterialResponse)
async def create_material(
    payload: MaterialCreateRequest,
    db: AsyncIOMotorDatabase = Depends(get_database),
) -> MaterialResponse:
    service = MaterialService(db)
    material = await service.create_material(payload.model_dump())
    return MaterialResponse(**material)


@router.post(
    "/materials/guardrail-check", response_model=MaterialGuardrailCheckResponse
)
async def check_material_guardrail(
    payload: MaterialGuardrailCheckRequest,
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
    title: str | None = Form(None),
    description: str | None = Form(None),
    subject: str | None = Form(None),
    education_level: str | None = Form(None),
    tags: str | None = Form(None),
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
        },
    )
    return MaterialGuardrailCheckResponse(**result)


@router.post("/materials/upload", response_model=MaterialResponse)
async def upload_material(
    file: UploadFile = File(...),
    user_id: str = Form("demo-user"),
    title: str | None = Form(None),
    description: str | None = Form(None),
    subject: str | None = Form(None),
    education_level: str | None = Form(None),
    tags: str | None = Form(None),
    db: AsyncIOMotorDatabase = Depends(get_database),
) -> MaterialResponse:
    service = MaterialService(db)
    material = await service.upload_material(
        user_id=user_id,
        file=file,
        metadata={
            "title": title,
            "description": description,
            "subject": subject,
            "education_level": education_level,
            "tags": [item.strip() for item in tags.split(",")] if tags else [],
        },
    )
    return MaterialResponse(**material)


@router.get("/materials", response_model=MaterialListResponse)
async def list_materials(
    skip: int = 0,
    limit: int = 20,
    db: AsyncIOMotorDatabase = Depends(get_database),
) -> MaterialListResponse:
    service = MaterialService(db)
    items, total = await service.list_materials(skip=skip, limit=limit)
    return MaterialListResponse(
        items=[MaterialResponse(**item) for item in items], total=total
    )


@router.get("/materials/{material_id}", response_model=MaterialResponse)
async def get_material(
    material_id: str,
    db: AsyncIOMotorDatabase = Depends(get_database),
) -> MaterialResponse:
    service = MaterialService(db)
    material = await service.get_material(material_id)
    return MaterialResponse(**material)


@router.post("/materials/{material_id}/process", response_model=MaterialProcessResponse)
async def process_material(
    material_id: str,
    payload: MaterialProcessRequest,
    db: AsyncIOMotorDatabase = Depends(get_database),
) -> MaterialProcessResponse:
    service = MaterialService(db)
    await service.enqueue_process(material_id, force_reprocess=payload.force_reprocess)
    return MaterialProcessResponse(
        material_id=material_id,
        processing_status="queued",
        message="Processing started in background",
    )


@router.delete("/materials/{material_id}")
async def delete_material(
    material_id: str,
    db: AsyncIOMotorDatabase = Depends(get_database),
) -> dict:
    service = MaterialService(db)
    deleted = await service.delete_material(material_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Material not found")
    return {"message": "Material deleted successfully"}
