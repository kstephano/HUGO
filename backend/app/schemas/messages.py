"""Message read schemas (messages are created by the agent loop, not directly by REST)."""
from datetime import datetime
from app.schemas.common import CamelModel


class MessageOut(CamelModel):
    id: str
    conversation_id: str
    role: str
    content: list | dict | str | None
    tool_calls: dict | None
    status: str
    input_tokens: int
    output_tokens: int
    cache_read_tokens: int
    cache_write_tokens: int
    created_at: datetime


class MessageList(CamelModel):
    items: list[MessageOut]
    total: int
