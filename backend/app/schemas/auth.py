from pydantic import BaseModel

class GoogleAuthRequest(BaseModel):
    id_token: str

class AuthUser(BaseModel):
    id: str
    email: str
    name: str | None = None
    picture: str | None = None

class AuthResponse(BaseModel):
    message: str
    user: AuthUser

class LogoutResponse(BaseModel):
    message: str
