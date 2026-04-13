from fastapi import APIRouter, Depends
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.api.dependencies import get_database, get_current_user
from app.schemas.auth import AuthUser
from app.schemas.games import (
    GameAttemptResponse,
    GameSubmitRequest,
    MinigamePersonalizationResponse,
    RemediationQuickStartRequest,
    RemediationQuickStartResponse,
)
from app.services.game_service import GameService
from app.services.personalization_service import PersonalizationService

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
    personalization_service = PersonalizationService(db)
    await personalization_service.track_event(
        user_id=user.id,
        event_type="game_attempt_submitted",
        resource_type="game_attempt",
        resource_id=attempt.get("id"),
        metadata={
            "generated_content_id": generated_content_id,
            "game_type": attempt.get("game_type"),
            "difficulty": attempt.get("difficulty"),
            "score": attempt.get("score"),
            "max_score": attempt.get("max_score"),
        },
    )
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


@router.post(
    "/games/materials/{material_id}/remediation-quick-start",
    response_model=RemediationQuickStartResponse,
)
async def remediation_quick_start(
    material_id: str,
    payload: RemediationQuickStartRequest,
    user: AuthUser = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database),
) -> RemediationQuickStartResponse:
    service = GameService(db)
    result = await service.generate_remediation_quick_start(
        material_id=material_id,
        user_id=user.id,
        difficulty=payload.difficulty,
        top_k_wrong_questions=payload.top_k_wrong_questions,
    )
    personalization_service = PersonalizationService(db)
    await personalization_service.track_event(
        user_id=user.id,
        event_type="remediation_quick_start_used",
        resource_type="material",
        resource_id=material_id,
        metadata={
            "difficulty": payload.difficulty,
            "top_k_wrong_questions": payload.top_k_wrong_questions,
            "generated_items": len(result.get("generated_items", [])),
        },
    )
    return RemediationQuickStartResponse(**result)
