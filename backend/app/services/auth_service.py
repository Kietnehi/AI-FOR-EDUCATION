import jwt
from datetime import datetime, timedelta, timezone
from fastapi import HTTPException
from google.oauth2 import id_token
from google.auth.transport import requests

from app.core.config import settings
from app.repositories.user_repository import UserRepository
from app.schemas.auth import AuthUser
from app.utils.time import utc_now

class AuthService:
    def __init__(self, user_repo: UserRepository):
        self.user_repo = user_repo
        self.client_id = settings.google_client_id

    async def verify_google_token(self, token: str) -> dict:
        if not self.client_id:
            raise HTTPException(status_code=500, detail="Google Client ID not configured")
        
        # We will determine if the token is an ID token (JWT format i.e. 3 parts separated by dots)
        # or an access token.
        if len(token.split('.')) == 3:
            try:
                # Verify the token against Google
                idinfo = id_token.verify_oauth2_token(
                    token,
                    requests.Request(),
                    self.client_id,
                    clock_skew_in_seconds=settings.google_token_clock_skew_seconds,
                )
                return idinfo
            except ValueError as e:
                error_text = str(e)
                if "Token used too early" in error_text:
                    raise HTTPException(
                        status_code=401,
                        detail="Invalid Google ID token: Token used too early. Please sync your system clock and try again.",
                    )
                raise HTTPException(status_code=401, detail=f"Invalid Google ID token: {error_text}")
        else:
            # It's an access token. Fetch user info from Google.
            import httpx
            async with httpx.AsyncClient() as client:
                response = await client.get(
                    "https://www.googleapis.com/oauth2/v3/userinfo",
                    headers={"Authorization": f"Bearer {token}"}
                )
                if response.status_code != 200:
                    raise HTTPException(status_code=401, detail="Invalid Google access token")
                userinfo = response.json()
                if not userinfo.get("email"):
                    raise HTTPException(status_code=400, detail="Email not provided by Google")
                # Map to match id_token format mostly
                userinfo["sub"] = userinfo.get("sub") or userinfo.get("id")
                return userinfo


    @staticmethod
    def _to_auth_user(user: dict) -> AuthUser:
        return AuthUser(
            id=user["id"],
            email=user["email"],
            name=user.get("name"),
            picture=user.get("picture"),
        )

    async def login_only(self, google_token: str) -> tuple[AuthUser, str]:
        idinfo = await self.verify_google_token(google_token)

        email = idinfo.get("email")
        picture = idinfo.get("picture")
        google_id = idinfo.get("sub")

        if not email:
            raise HTTPException(status_code=400, detail="Email not provided by Google")

        user = await self.user_repo.find_by_email(email)
        if not user:
            raise HTTPException(
                status_code=404,
                detail="Tài khoản chưa tồn tại. Vui lòng đăng ký trước.",
            )

        now = utc_now()
        update_data = {"last_login_at": now}
        if not user.get("picture") and picture:
            update_data["picture"] = picture
        if not user.get("google_id") and google_id:
            update_data["google_id"] = google_id

        updated_user = await self.user_repo.update(user["id"], update_data)
        if not updated_user:
            raise HTTPException(status_code=500, detail="Không thể cập nhật thông tin tài khoản")

        auth_user = self._to_auth_user(updated_user)
        jwt_token = self.create_access_token(
            data={"sub": auth_user.id, "email": auth_user.email}
        )
        return auth_user, jwt_token

    async def register_only(self, google_token: str) -> tuple[AuthUser, str]:
        idinfo = await self.verify_google_token(google_token)

        email = idinfo.get("email")
        name = idinfo.get("name")
        picture = idinfo.get("picture")
        google_id = idinfo.get("sub")

        if not email:
            raise HTTPException(status_code=400, detail="Email not provided by Google")

        existing_user = await self.user_repo.find_by_email(email)
        if existing_user:
            raise HTTPException(
                status_code=409,
                detail="Tài khoản đã tồn tại. Vui lòng đăng nhập.",
            )

        now = utc_now()
        created_user = await self.user_repo.create(
            {
                "email": email,
                "name": name,
                "picture": picture,
                "google_id": google_id,
                "role": "user",
                "status": "active",
                "created_at": now,
                "last_login_at": now,
            }
        )

        auth_user = self._to_auth_user(created_user)
        jwt_token = self.create_access_token(
            data={"sub": auth_user.id, "email": auth_user.email}
        )
        return auth_user, jwt_token

    def create_access_token(self, data: dict) -> str:
        to_encode = data.copy()
        expire = datetime.now(timezone.utc) + timedelta(minutes=settings.jwt_expiration_minutes)
        to_encode.update({"exp": expire})
        encoded_jwt = jwt.encode(
            to_encode, settings.jwt_secret_key, algorithm=settings.jwt_algorithm
        )
        return encoded_jwt

    def verify_jwt(self, token: str) -> dict:
        try:
            payload = jwt.decode(
                token, settings.jwt_secret_key, algorithms=[settings.jwt_algorithm]
            )
            return payload
        except jwt.ExpiredSignatureError:
            raise HTTPException(status_code=401, detail="Token has expired")
        except jwt.InvalidTokenError:
            raise HTTPException(status_code=401, detail="Invalid token")
