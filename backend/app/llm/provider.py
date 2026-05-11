"""
LLMProvider protocol and typed streaming event union.
All providers must implement stream_message(); the orchestrator consumes events.
"""
from __future__ import annotations
from dataclasses import dataclass, field
from typing import Any, AsyncIterator, Protocol, runtime_checkable


@dataclass
class TextDeltaEvent:
    text: str


@dataclass
class ThinkingDeltaEvent:
    text: str


@dataclass
class ToolUseEvent:
    tool_use_id: str
    name: str
    input: dict[str, Any]


@dataclass
class UsageEvent:
    input_tokens: int
    output_tokens: int
    cache_read_tokens: int = 0
    cache_write_tokens: int = 0


@dataclass
class StopEvent:
    stop_reason: str  # "end_turn" | "tool_use" | "max_tokens" | "cancelled"


LLMEvent = TextDeltaEvent | ThinkingDeltaEvent | ToolUseEvent | UsageEvent | StopEvent


@runtime_checkable
class LLMProvider(Protocol):
    async def stream_message(
        self,
        *,
        system: str | list[dict],
        messages: list[dict],
        tools: list[dict],
        conversation_id: str,
    ) -> AsyncIterator[LLMEvent]: ...
