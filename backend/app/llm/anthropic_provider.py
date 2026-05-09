"""
Anthropic streaming provider.
Extended thinking is enabled only when ANTHROPIC_THINKING_BUDGET > 0.
Prompt caching is applied to the system prompt and tool definitions via cache_control.
"""
from __future__ import annotations
import asyncio
from typing import AsyncIterator
import anthropic
from app.core.config import get_settings
from app.core.logging import get_logger
from app.llm.provider import (
    LLMEvent, StopEvent, TextDeltaEvent, ThinkingDeltaEvent, ToolUseEvent, UsageEvent,
)

log = get_logger(__name__)


class AnthropicProvider:
    def __init__(self) -> None:
        settings = get_settings()
        self._client = anthropic.AsyncAnthropic(api_key=settings.anthropic_api_key)
        self._model = settings.anthropic_model
        self._max_tokens = settings.anthropic_max_tokens
        self._thinking_budget = settings.anthropic_thinking_budget

    async def stream_message(
        self,
        *,
        system: str,
        messages: list[dict],
        tools: list[dict],
        conversation_id: str,
    ) -> AsyncIterator[LLMEvent]:
        # Mark system prompt for prompt caching (stable across turns)
        system_block = [{"type": "text", "text": system, "cache_control": {"type": "ephemeral"}}]

        # Mark tool definitions for prompt caching (stable within session)
        cached_tools = []
        for i, tool in enumerate(tools):
            t = dict(tool)
            if i == len(tools) - 1:
                t["cache_control"] = {"type": "ephemeral"}
            cached_tools.append(t)

        # Extended thinking: only enabled when budget > 0.
        # Requires temperature=1.0 — the Anthropic API rejects other values when thinking is on.
        if self._thinking_budget > 0:
            thinking_param = {"type": "enabled", "budget_tokens": self._thinking_budget}
            temperature = 1.0
        else:
            thinking_param = anthropic.NOT_GIVEN
            temperature = anthropic.NOT_GIVEN

        stream_kwargs = dict(
            model=self._model,
            max_tokens=self._max_tokens,
            temperature=temperature,
            thinking=thinking_param,
            system=system_block,
            tools=cached_tools or anthropic.NOT_GIVEN,
            messages=messages,
        )

        tool_inputs: dict[str, dict] = {}
        tool_names: dict[str, str] = {}

        try:
            async with self._client.messages.stream(**stream_kwargs) as stream:
                async for event in stream:
                    etype = type(event).__name__

                    if etype == "RawContentBlockStartEvent":
                        block = event.content_block
                        if block.type == "tool_use":
                            tool_inputs[block.id] = {}
                            tool_names[block.id] = block.name
                        elif block.type == "thinking":
                            pass  # handled via delta

                    elif etype == "RawContentBlockDeltaEvent":
                        delta = event.delta
                        dtype = type(delta).__name__
                        if dtype == "TextDelta":
                            yield TextDeltaEvent(text=delta.text)
                        elif dtype == "ThinkingDelta":
                            yield ThinkingDeltaEvent(text=delta.thinking)
                        elif dtype == "InputJSONDelta":
                            # Accumulate JSON input for tool calls
                            block_id = None
                            for tid in tool_inputs:
                                # The last registered tool id receives the delta
                                block_id = tid
                            if block_id and hasattr(delta, "partial_json"):
                                existing = tool_inputs.get(block_id, {})
                                # We'll reassemble via the final message
                                tool_inputs[block_id] = existing

                    elif etype == "RawContentBlockStopEvent":
                        pass

                    elif etype == "RawMessageDeltaEvent":
                        if hasattr(event, "usage"):
                            u = event.usage
                            yield UsageEvent(
                                input_tokens=0,
                                output_tokens=getattr(u, "output_tokens", 0),
                                cache_read_tokens=0,
                                cache_write_tokens=0,
                            )
                        if hasattr(event, "delta") and hasattr(event.delta, "stop_reason"):
                            yield StopEvent(stop_reason=event.delta.stop_reason or "end_turn")

                    elif etype == "RawMessageStartEvent":
                        if hasattr(event, "message") and hasattr(event.message, "usage"):
                            u = event.message.usage
                            yield UsageEvent(
                                input_tokens=getattr(u, "input_tokens", 0),
                                output_tokens=0,
                                cache_read_tokens=getattr(u, "cache_read_input_tokens", 0),
                                cache_write_tokens=getattr(u, "cache_creation_input_tokens", 0),
                            )

                # After stream completes, emit ToolUseEvents for accumulated tools
                final = await stream.get_final_message()
                for block in final.content:
                    if block.type == "tool_use":
                        yield ToolUseEvent(
                            tool_use_id=block.id,
                            name=block.name,
                            input=block.input or {},
                        )

        except anthropic.APIStatusError as exc:
            log.error("anthropic_api_error", status=exc.status_code, error=str(exc))
            raise
        except asyncio.CancelledError:
            yield StopEvent(stop_reason="cancelled")
            raise
