from fastapi import APIRouter, Depends
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.api.dependencies import get_database
from app.schemas.generated_content import (
    GenerateMinigameRequest,
    GeneratePodcastRequest,
    GenerateSlidesRequest,
    GeneratedContentResponse,
)
from app.services.generation_service import GenerationService

router = APIRouter()


@router.post("/materials/{material_id}/generate/slides", response_model=GeneratedContentResponse)
async def generate_slides(
    material_id: str,
    payload: GenerateSlidesRequest,
    db: AsyncIOMotorDatabase = Depends(get_database),
) -> GeneratedContentResponse:
    service = GenerationService(db)
    result = await service.generate_slides(material_id, tone=payload.tone, max_slides=payload.max_slides)
    return GeneratedContentResponse(**result)


@router.post("/materials/{material_id}/generate/podcast", response_model=GeneratedContentResponse)
async def generate_podcast(
    material_id: str,
    payload: GeneratePodcastRequest,
    db: AsyncIOMotorDatabase = Depends(get_database),
) -> GeneratedContentResponse:
    service = GenerationService(db)
    result = await service.generate_podcast(
        material_id,
        style=payload.style,
        target_duration_minutes=payload.target_duration_minutes,
    )
    return GeneratedContentResponse(**result)


@router.post("/materials/{material_id}/generate/minigame", response_model=GeneratedContentResponse)
async def generate_minigame(
    material_id: str,
    payload: GenerateMinigameRequest,
    db: AsyncIOMotorDatabase = Depends(get_database),
) -> GeneratedContentResponse:
    service = GenerationService(db)
    result = await service.generate_minigame(material_id, game_types=payload.game_types)
    return GeneratedContentResponse(**result)


@router.get("/generated-contents/{content_id}", response_model=GeneratedContentResponse)
async def get_generated_content(
    content_id: str,
    db: AsyncIOMotorDatabase = Depends(get_database),
) -> GeneratedContentResponse:
    service = GenerationService(db)
    result = await service.get_generated_content(content_id)
    return GeneratedContentResponse(**result)
