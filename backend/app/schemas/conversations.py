"""Conversation CRUD schemas."""
from datetime import datetime
from app.schemas.common import CamelModel


class ConversationCreate(CamelModel):
    title: str | None = None


class ConversationOut(CamelModel):
    id: str
    title: str | None
    created_at: datetime
    updated_at: datetime


class ConversationList(CamelModel):
    items: list[ConversationOut]
    total: int
