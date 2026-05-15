"""Auth-related request/response schemas."""
from pydantic import EmailStr, Field
from app.schemas.common import CamelModel


class DevLoginRequest(CamelModel):
    email: EmailStr
    display_name: str = "Dev User"


class GoogleLoginRequest(CamelModel):
    credential: str


class EmailRegisterRequest(CamelModel):
    email: EmailStr
    display_name: str = Field(min_length=1, max_length=100)
    password: str = Field(min_length=8, max_length=128)


class EmailLoginRequest(CamelModel):
    email: EmailStr
    password: str


class SettingsUpdateRequest(CamelModel):
    remember_conversations: bool


class SessionResponse(CamelModel):
    user_id: str
    email: str
    display_name: str
    avatar_url: str | None = None
    remember_conversations: bool = True
