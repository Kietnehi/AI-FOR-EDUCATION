from fastapi import APIRouter, Depends
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.api.dependencies import get_database, get_current_user
from app.schemas.auth import AuthUser
from app.schemas.games import GameAttemptResponse, GameSubmitRequest, MinigamePersonalizationResponse
from app.services.game_service import GameService

router = APIRouter()


@router.post("/games/{generated_content_id}/submit", response_model=GameAttemptResponse)
async def submit_game_attempt(
    generated_content_id: str,
    payload: GameSubmitRequest,
    user: AuthUser = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database),
) -> GameAttemptResponse:
    service = GameService(db)
    attempt = await service.submit_attempt(generated_content_id, user.id, payload.answers)
    return GameAttemptResponse(**attempt)


@router.get("/games/attempts/{attempt_id}", response_model=GameAttemptResponse)
async def get_attempt(
    attempt_id: str,
    user: AuthUser = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database),
) -> GameAttemptResponse:
    service = GameService(db)
    attempt = await service.get_attempt(attempt_id, user_id=user.id)
    return GameAttemptResponse(**attempt)


@router.get("/games/materials/{material_id}/personalization", response_model=MinigamePersonalizationResponse)
async def get_personalization(
    material_id: str,
    user: AuthUser = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database),
) -> MinigamePersonalizationResponse:
    service = GameService(db)
    result = await service.get_personalization_summary(material_id=material_id, user_id=user.id)
    return MinigamePersonalizationResponse(**result)
