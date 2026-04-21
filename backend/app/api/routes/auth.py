from fastapi import APIRouter, Depends, HTTPException, Response, status
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.api.dependencies import get_current_user, get_database
from app.core.config import settings
from app.repositories.user_repository import UserRepository
from app.schemas.auth import AuthResponse, AuthUser, GoogleAuthRequest, LogoutResponse
from app.services.auth_service import AuthService
from app.services.turnstile_service import TurnstileVerificationError, verify_turnstile_token

router = APIRouter()

<<<<<<< HEAD

def _cookie_samesite_value() -> str:
    # Cross-origin requests (frontend tunnel -> backend tunnel) need SameSite=None.
    # Browsers require Secure=true when SameSite=None.
    return "none" if settings.auth_cookie_secure else "lax"

=======
>>>>>>> a78aa0fd5a16184ec5ef421650b3c03395164c66
@router.post("/auth/google/login", response_model=AuthResponse)
async def google_login(
    payload: GoogleAuthRequest,
    response: Response,
    db: AsyncIOMotorDatabase = Depends(get_database),
) -> AuthResponse:
    # Verify CAPTCHA first
    try:
        await verify_turnstile_token(payload.captcha_token)
    except TurnstileVerificationError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))

    user_repo = UserRepository(db)
    auth_service = AuthService(user_repo)
    
    auth_user, jwt_token = await auth_service.login_only(payload.id_token)
    
    response.set_cookie(
        key=settings.auth_cookie_name,
        value=jwt_token,
        httponly=True,
        secure=settings.auth_cookie_secure,
<<<<<<< HEAD
        samesite=_cookie_samesite_value(),
=======
        samesite="lax",  # Prevent CSRF
>>>>>>> a78aa0fd5a16184ec5ef421650b3c03395164c66
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
    # Verify CAPTCHA first
    try:
        await verify_turnstile_token(payload.captcha_token)
    except TurnstileVerificationError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))

    user_repo = UserRepository(db)
    auth_service = AuthService(user_repo)

    auth_user, jwt_token = await auth_service.register_only(payload.id_token)

    response.set_cookie(
        key=settings.auth_cookie_name,
        value=jwt_token,
        httponly=True,
        secure=settings.auth_cookie_secure,
<<<<<<< HEAD
        samesite=_cookie_samesite_value(),
=======
        samesite="lax",
>>>>>>> a78aa0fd5a16184ec5ef421650b3c03395164c66
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
<<<<<<< HEAD
        samesite=_cookie_samesite_value()
=======
        samesite="lax"
>>>>>>> a78aa0fd5a16184ec5ef421650b3c03395164c66
    )
    return LogoutResponse(message="Successfully logged out")

@router.get("/auth/me", response_model=AuthUser)
async def get_me(user: AuthUser = Depends(get_current_user)) -> AuthUser:
    return user
<<<<<<< HEAD
=======


@router.get("/auth/users/search", response_model=list[AuthUser])
async def search_users(
    q: str,
    db: AsyncIOMotorDatabase = Depends(get_database),
    current_user: AuthUser = Depends(get_current_user),
) -> list[AuthUser]:
    user_repo = UserRepository(db)
    results = await user_repo.search(q)
    return [AuthUser(**u) for u in results]
>>>>>>> a78aa0fd5a16184ec5ef421650b3c03395164c66
