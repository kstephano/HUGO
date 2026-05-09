"""WebSocket frame schemas — all frames are JSON-encoded."""
from __future__ import annotations
from typing import Literal
from pydantic import BaseModel


class WsHandshake(BaseModel):
    type: Literal["handshake"] = "handshake"
    conversation_id: str


class WsUserMessage(BaseModel):
    type: Literal["message"] = "message"
    content: str
    client_message_id: str


class WsCancel(BaseModel):
    type: Literal["cancel"] = "cancel"


class WsStreamDelta(BaseModel):
    type: Literal["delta"] = "delta"
    text: str


class WsThinkingDelta(BaseModel):
    type: Literal["thinking"] = "thinking"
    text: str


class WsToolStart(BaseModel):
    type: Literal["tool_start"] = "tool_start"
    tool_name: str
    tool_use_id: str


class WsToolResult(BaseModel):
    type: Literal["tool_result"] = "tool_result"
    tool_use_id: str
    content: str


class WsDone(BaseModel):
    type: Literal["done"] = "done"
    message_id: str
    input_tokens: int
    output_tokens: int
    cache_read_tokens: int
    cache_write_tokens: int


class WsError(BaseModel):
    type: Literal["error"] = "error"
    code: str
    message: str


class WsRateLimited(BaseModel):
    type: Literal["rate_limited"] = "rate_limited"
    retry_after: int = 60


class WsTitle(BaseModel):
    type: Literal["title"] = "title"
    title: str
