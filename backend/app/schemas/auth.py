"""Auth-related request/response schemas."""
from pydantic import EmailStr
from app.schemas.common import CamelModel


class DevLoginRequest(CamelModel):
    email: EmailStr
    display_name: str = "Dev User"


class SessionResponse(CamelModel):
    user_id: str
    email: str
    display_name: str
