from fastapi import APIRouter, Depends
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.api.dependencies import get_database
from app.schemas.games import GameAttemptResponse, GameSubmitRequest
from app.services.game_service import GameService

router = APIRouter()


@router.post("/games/{generated_content_id}/submit", response_model=GameAttemptResponse)
async def submit_game_attempt(
    generated_content_id: str,
    payload: GameSubmitRequest,
    db: AsyncIOMotorDatabase = Depends(get_database),
) -> GameAttemptResponse:
    service = GameService(db)
    attempt = await service.submit_attempt(generated_content_id, payload.user_id, payload.answers)
    return GameAttemptResponse(**attempt)


@router.get("/games/attempts/{attempt_id}", response_model=GameAttemptResponse)
async def get_attempt(
    attempt_id: str,
    db: AsyncIOMotorDatabase = Depends(get_database),
) -> GameAttemptResponse:
    service = GameService(db)
    attempt = await service.get_attempt(attempt_id)
    return GameAttemptResponse(**attempt)
