"""Deterministic mock LLM for offline dev and CI — never calls the Anthropic API."""
from __future__ import annotations
import asyncio
import hashlib
from typing import AsyncIterator
from app.llm.provider import LLMEvent, StopEvent, TextDeltaEvent, UsageEvent


class MockLLMProvider:
    async def stream_message(
        self,
        *,
        system: str,
        messages: list[dict],
        tools: list[dict],
        conversation_id: str,
    ) -> AsyncIterator[LLMEvent]:
        # Deterministic response keyed on last user message content
        last_content = ""
        for msg in reversed(messages):
            if msg.get("role") == "user":
                c = msg.get("content", "")
                last_content = c if isinstance(c, str) else str(c)
                break

        digest = hashlib.md5(last_content.encode()).hexdigest()[:8]
        response = f"[MOCK] echo:{digest} — {last_content[:80]}"

        for chunk in [response[i:i+20] for i in range(0, len(response), 20)]:
            yield TextDeltaEvent(text=chunk)
            await asyncio.sleep(0.01)

        yield UsageEvent(input_tokens=10, output_tokens=len(response) // 4)
        yield StopEvent(stop_reason="end_turn")
