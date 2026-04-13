from fastapi import APIRouter, Depends
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.api.dependencies import get_current_user, get_database
from app.schemas.auth import AuthUser
from app.schemas.personalization import (
    DashboardPersonalizationResponse,
    PersonalizationPreferencesResponse,
    PersonalizationPreferencesUpdateRequest,
)
from app.services.personalization_service import PersonalizationService

router = APIRouter()


@router.get(
    "/personalization/preferences",
    response_model=PersonalizationPreferencesResponse,
)
async def get_preferences(
    user: AuthUser = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database),
) -> PersonalizationPreferencesResponse:
    service = PersonalizationService(db)
    preferences = await service.get_or_init_preferences(user.id)
    await service.track_event(
        user_id=user.id,
        event_type="personalization_preferences_viewed",
        resource_type="preferences",
    )
    return PersonalizationPreferencesResponse(**preferences)


@router.put(
    "/personalization/preferences",
    response_model=PersonalizationPreferencesResponse,
)
async def update_preferences(
    payload: PersonalizationPreferencesUpdateRequest,
    user: AuthUser = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database),
) -> PersonalizationPreferencesResponse:
    service = PersonalizationService(db)
    update_payload = payload.model_dump(exclude_none=True)
    preferences = await service.update_preferences(
        user_id=user.id,
        payload=update_payload,
    )
    await service.track_event(
        user_id=user.id,
        event_type="personalization_preferences_updated",
        resource_type="preferences",
        metadata={"updated_keys": sorted(update_payload.keys())},
    )
    return PersonalizationPreferencesResponse(**preferences)


@router.get(
    "/personalization/dashboard",
    response_model=DashboardPersonalizationResponse,
)
async def get_dashboard_personalization(
    user: AuthUser = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database),
) -> DashboardPersonalizationResponse:
    service = PersonalizationService(db)
    payload = await service.build_dashboard_personalization(user.id)
    await service.track_event(
        user_id=user.id,
        event_type="personalization_dashboard_viewed",
        resource_type="dashboard",
        metadata={"next_actions_count": len(payload.get("next_actions", []))},
    )
    return DashboardPersonalizationResponse(**payload)
