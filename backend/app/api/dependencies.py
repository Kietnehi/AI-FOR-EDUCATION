from motor.motor_asyncio import AsyncIOMotorDatabase
from fastapi import Request, HTTPException, Depends
import jwt

from app.db.mongo import get_db
from app.core.config import settings
from app.schemas.auth import AuthUser
from app.repositories.user_repository import UserRepository


async def get_database() -> AsyncIOMotorDatabase:
    return get_db()


async def get_current_user(request: Request, db: AsyncIOMotorDatabase = Depends(get_database)) -> AuthUser:
    token = request.cookies.get(settings.auth_cookie_name)
    if not token:
        from app.core.logging import logger
        logger.warning(f"No auth cookie found. Available cookies: {request.cookies.keys()}")
        raise HTTPException(status_code=401, detail="Authentication required")

    try:
        payload = jwt.decode(
            token, settings.jwt_secret_key, algorithms=[settings.jwt_algorithm]
        )
        user_id = payload.get("sub")
        email = payload.get("email")
        
        if not user_id or not email:
            raise HTTPException(status_code=401, detail="Invalid auth token payload")
        
        # We can optionally fetch the user from DB here to ensure they still exist
        user_repo = UserRepository(db)
        user = await user_repo.find_by_email(email)
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
            
        return AuthUser(
            id=user["id"],
            email=user["email"],
            name=user.get("name"),
            picture=user.get("picture")
        )
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token has expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")
