from fastapi import APIRouter, Depends, Response
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.api.dependencies import get_current_user, get_database
from app.core.config import settings
from app.repositories.user_repository import UserRepository
from app.schemas.auth import AuthResponse, AuthUser, GoogleAuthRequest, LogoutResponse
from app.services.auth_service import AuthService

router = APIRouter()

@router.post("/auth/google/login", response_model=AuthResponse)
async def google_login(
    payload: GoogleAuthRequest,
    response: Response,
    db: AsyncIOMotorDatabase = Depends(get_database),
) -> AuthResponse:
    user_repo = UserRepository(db)
    auth_service = AuthService(user_repo)
    
    auth_user, jwt_token = await auth_service.login_only(payload.id_token)
    
    response.set_cookie(
        key=settings.auth_cookie_name,
        value=jwt_token,
        httponly=True,
        secure=settings.auth_cookie_secure,
        samesite="lax",  # Prevent CSRF
        max_age=settings.jwt_expiration_minutes * 60,
        path="/"
    )
    
    return AuthResponse(message="Successfully logged in", user=auth_user)


@router.post("/auth/google/register", response_model=AuthResponse)
async def google_register(
    payload: GoogleAuthRequest,
    response: Response,
    db: AsyncIOMotorDatabase = Depends(get_database),
) -> AuthResponse:
    user_repo = UserRepository(db)
    auth_service = AuthService(user_repo)

    auth_user, jwt_token = await auth_service.register_only(payload.id_token)

    response.set_cookie(
        key=settings.auth_cookie_name,
        value=jwt_token,
        httponly=True,
        secure=settings.auth_cookie_secure,
        samesite="lax",
        max_age=settings.jwt_expiration_minutes * 60,
        path="/",
    )

    return AuthResponse(message="Successfully registered", user=auth_user)

@router.post("/auth/logout", response_model=LogoutResponse)
async def logout(response: Response) -> LogoutResponse:
    response.delete_cookie(
        key=settings.auth_cookie_name,
        path="/",
        secure=settings.auth_cookie_secure,
        httponly=True,
        samesite="lax"
    )
    return LogoutResponse(message="Successfully logged out")

@router.get("/auth/me", response_model=AuthUser)
async def get_me(user: AuthUser = Depends(get_current_user)) -> AuthUser:
    return user
