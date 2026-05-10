"""
Custom agent loop — no LangChain/LangGraph.

Flow per turn:
1. Build messages from DB history (with rolling summary if present)
2. Stream LLM response, time-batching text deltas (50ms) into the send queue
3. On tool_use stop: run tools in parallel (cap 5, 30s timeout each)
4. Inject tool results and loop (max 5 iterations)
5. On end_turn: persist assistant message, maybe summarize, emit done frame
6. On cancel: persist partial message with status=cancelled, emit done frame
"""
from __future__ import annotations
import asyncio
import json
import uuid
from typing import AsyncIterator, Callable, Awaitable

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.cancel_bus import is_cancelled, watch_cancel
from app.core.config import get_settings
from app.core.locks import acquire_tool_lock
from app.core.logging import get_logger
from app.db.models import Conversation
from app.embeddings.provider import EmbeddingProvider
from app.llm.provider import (
    LLMProvider, LLMEvent,
    TextDeltaEvent, ThinkingDeltaEvent, ToolUseEvent, UsageEvent, StopEvent,
)
from app.orchestrator.history import SYSTEM_PROMPT, build_messages, estimate_tokens
from app.orchestrator.persistence import (
    load_conversation, save_assistant_message, save_user_message,
    set_conversation_title, update_conversation_summary,
)
from app.orchestrator.summarizer import maybe_summarize
from app.schemas.websocket import (
    WsDone, WsError, WsStreamDelta, WsThinkingDelta, WsTitle, WsToolResult, WsToolStart,
)
from app.tools.registry import ToolRegistry

log = get_logger(__name__)

_BATCH_INTERVAL = 0.05  # 50ms text-batching window
_TOOL_CONCURRENCY = 5


SendFn = Callable[[str], Awaitable[None]]


async def run_loop(
    *,
    conversation_id: str,
    user_id: str,
    user_content: str,
    client_message_id: str,
    db: AsyncSession,
    redis_client,
    llm: LLMProvider,
    embed_provider: EmbeddingProvider,
    registry: ToolRegistry,
    send: SendFn,
) -> None:
    settings = get_settings()
    conversation = await load_conversation(db, conversation_id, user_id)
    if conversation is None:
        await send(WsError(code="not_found", message="Conversation not found").model_dump_json())
        return

    # Build history from the already-loaded conversation, then persist and append
    # the user turn. Reloading the conversation after commit hits SQLAlchemy's
    # identity map (expire_on_commit=False) and returns stale cached messages.
    messages = build_messages(conversation)
    await save_user_message(db, conversation_id, user_content, client_message_id)
    messages.append({"role": "user", "content": user_content})

    accumulated_text: list[str] = []
    accumulated_thinking: list[str] = []
    tool_calls_by_id: dict[str, dict] = {}
    total_usage = {"input_tokens": 0, "output_tokens": 0, "cache_read": 0, "cache_write": 0}
    final_message_id: str | None = None
    final_status = "completed"

    async with watch_cancel(conversation_id) as cancel_event:
        for iteration in range(settings.max_tool_iterations + 1):
            if cancel_event.is_set():
                final_status = "cancelled"
                break

            stop_reason = "end_turn"
            pending_tool_uses: list[ToolUseEvent] = []
            iter_text: list[str] = []

            # ── Streaming with 50ms text batching ──────────────────────────────
            flush_queue: asyncio.Queue[str | None] = asyncio.Queue()

            async def flush_task():
                buf = []
                while True:
                    try:
                        item = await asyncio.wait_for(flush_queue.get(), timeout=_BATCH_INTERVAL)
                        if item is None:
                            break
                        buf.append(item)
                    except asyncio.TimeoutError:
                        if buf:
                            await send(WsStreamDelta(text="".join(buf)).model_dump_json())
                            buf = []
                if buf:
                    await send(WsStreamDelta(text="".join(buf)).model_dump_json())

            flush_t = asyncio.create_task(flush_task())

            try:
                async for event in llm.stream_message(
                    system=SYSTEM_PROMPT,
                    messages=messages,
                    tools=registry.schemas(),
                    conversation_id=conversation_id,
                ):
                    if cancel_event.is_set():
                        final_status = "cancelled"
                        break

                    if isinstance(event, TextDeltaEvent):
                        iter_text.append(event.text)
                        await flush_queue.put(event.text)

                    elif isinstance(event, ThinkingDeltaEvent):
                        accumulated_thinking.append(event.text)
                        # Thinking frames bypass batching — sent immediately
                        await flush_queue.put(None)  # flush pending text first
                        flush_t.cancel()
                        try:
                            await flush_t
                        except (asyncio.CancelledError, Exception):
                            pass
                        await send(WsThinkingDelta(text=event.text).model_dump_json())
                        flush_queue = asyncio.Queue()
                        flush_t = asyncio.create_task(flush_task())

                    elif isinstance(event, ToolUseEvent):
                        pending_tool_uses.append(event)
                        # Tool events bypass batching
                        await flush_queue.put(None)
                        flush_t.cancel()
                        try:
                            await flush_t
                        except (asyncio.CancelledError, Exception):
                            pass
                        await send(WsToolStart(
                            tool_name=event.name,
                            tool_use_id=event.tool_use_id,
                        ).model_dump_json())
                        flush_queue = asyncio.Queue()
                        flush_t = asyncio.create_task(flush_task())

                    elif isinstance(event, UsageEvent):
                        total_usage["input_tokens"] += event.input_tokens
                        total_usage["output_tokens"] += event.output_tokens
                        total_usage["cache_read"] += event.cache_read_tokens
                        total_usage["cache_write"] += event.cache_write_tokens

                    elif isinstance(event, StopEvent):
                        stop_reason = event.stop_reason

            finally:
                await flush_queue.put(None)
                try:
                    await flush_t
                except (asyncio.CancelledError, Exception):
                    pass

            accumulated_text.extend(iter_text)

            # ── Tool execution ──────────────────────────────────────────────────
            if stop_reason == "tool_use" and pending_tool_uses and final_status != "cancelled":
                tool_results = await _run_tools_parallel(
                    pending_tool_uses, registry, db, embed_provider, redis_client,
                    cancel_event, settings.tool_timeout_seconds,
                )
                for tr in tool_results:
                    tool_calls_by_id[tr["tool_use_id"]] = tr
                    await send(WsToolResult(
                        tool_use_id=tr["tool_use_id"],
                        content=tr["content"],
                    ).model_dump_json())

                # Build tool result messages and append to history for next iteration
                assistant_content = _build_assistant_content(iter_text, pending_tool_uses)
                messages.append({"role": "assistant", "content": assistant_content})
                messages.append({
                    "role": "user",
                    "content": [
                        {"type": "tool_result", "tool_use_id": tr["tool_use_id"], "content": tr["content"]}
                        for tr in tool_results
                    ],
                })
                continue  # next iteration

            # ── Finished (end_turn, max_tokens, or cancelled) ───────────────────
            break

    # Persist assistant message
    assistant_content_blocks = _build_final_content(accumulated_text, accumulated_thinking)
    final_msg = await save_assistant_message(
        db,
        conversation_id=conversation_id,
        content=assistant_content_blocks,
        tool_calls=tool_calls_by_id if tool_calls_by_id else None,
        status=final_status,
        input_tokens=total_usage["input_tokens"],
        output_tokens=total_usage["output_tokens"],
        cache_read_tokens=total_usage["cache_read"],
        cache_write_tokens=total_usage["cache_write"],
    )
    final_message_id = final_msg.id

    # Auto-title on the first completed response
    if final_status == "completed" and not conversation.title:
        title = await set_conversation_title(db, conversation_id, user_id, user_content)
        await send(WsTitle(title=title).model_dump_json())

    # Rolling summary
    if final_status == "completed":
        new_summary = await maybe_summarize(conversation, messages, conversation.rolling_summary)
        if new_summary:
            await update_conversation_summary(db, conversation_id, user_id, new_summary)

    await send(WsDone(
        message_id=final_message_id,
        input_tokens=total_usage["input_tokens"],
        output_tokens=total_usage["output_tokens"],
        cache_read_tokens=total_usage["cache_read"],
        cache_write_tokens=total_usage["cache_write"],
    ).model_dump_json())


async def _run_tools_parallel(
    tool_uses: list[ToolUseEvent],
    registry: ToolRegistry,
    db: AsyncSession,
    embed_provider: EmbeddingProvider,
    redis_client,
    cancel_event: asyncio.Event,
    timeout: int,
) -> list[dict]:
    sem = asyncio.Semaphore(_TOOL_CONCURRENCY)
    ctx = {"db": db, "embed_provider": embed_provider}

    async def _run_one(tu: ToolUseEvent) -> dict:
        async with sem:
            if cancel_event.is_set():
                return {"tool_use_id": tu.tool_use_id, "content": "Cancelled"}

            tool = registry.get(tu.name)
            if tool is None:
                return {"tool_use_id": tu.tool_use_id, "content": f"Unknown tool: {tu.name}"}

            if tool.requires_lock:
                lock_key = tool.lock_key(tu.input)
                async with acquire_tool_lock(redis_client, lock_key) as acquired:
                    if not acquired:
                        return {"tool_use_id": tu.tool_use_id, "content": "Tool temporarily locked"}
                    try:
                        result = await asyncio.wait_for(tool(tu.input, **ctx), timeout=timeout)
                    except asyncio.TimeoutError:
                        result = f"Tool timed out after {timeout}s"
            else:
                try:
                    result = await asyncio.wait_for(tool(tu.input, **ctx), timeout=timeout)
                except asyncio.TimeoutError:
                    result = f"Tool timed out after {timeout}s"

            return {"tool_use_id": tu.tool_use_id, "content": result}

    tasks = [asyncio.create_task(_run_one(tu)) for tu in tool_uses]
    return await asyncio.gather(*tasks)


def _build_assistant_content(text_parts: list[str], tool_uses: list[ToolUseEvent]) -> list[dict]:
    blocks = []
    combined_text = "".join(text_parts)
    if combined_text:
        blocks.append({"type": "text", "text": combined_text})
    for tu in tool_uses:
        blocks.append({"type": "tool_use", "id": tu.tool_use_id, "name": tu.name, "input": tu.input})
    return blocks


def _build_final_content(text_parts: list[str], thinking_parts: list[str]) -> list[dict]:
    blocks = []
    combined_thinking = "".join(thinking_parts)
    if combined_thinking:
        blocks.append({"type": "thinking", "thinking": combined_thinking})
    combined_text = "".join(text_parts)
    if combined_text:
        blocks.append({"type": "text", "text": combined_text})
    return blocks or [{"type": "text", "text": ""}]
