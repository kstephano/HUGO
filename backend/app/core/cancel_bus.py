"""
Single global PSUBSCRIBE cancel:* subscription with per-conversation asyncio.Event signalling.
One subscription per process instance; in-memory dict routes to waiters.
"""
from __future__ import annotations
import asyncio
from collections import defaultdict
from contextlib import asynccontextmanager
from app.core.logging import get_logger

log = get_logger(__name__)

_events: dict[str, asyncio.Event] = defaultdict(asyncio.Event)
_listener_task: asyncio.Task | None = None
_pubsub = None


async def _listen(pubsub) -> None:
    try:
        async for message in pubsub.listen():
            if message["type"] != "pmessage":
                continue
            channel: str = message["channel"]
            # channel pattern: cancel:{conversation_id}
            conv_id = channel.split(":", 1)[1] if ":" in channel else channel
            ev = _events.get(conv_id)
            if ev:
                ev.set()
                log.info("cancel_received", conversation_id=conv_id)
    except asyncio.CancelledError:
        pass
    except Exception as exc:
        log.error("cancel_bus_listener_error", error=str(exc))


async def start(redis_client) -> None:
    global _pubsub, _listener_task
    _pubsub = redis_client.pubsub()
    await _pubsub.psubscribe("cancel:*")
    _listener_task = asyncio.create_task(_listen(_pubsub))
    log.info("cancel_bus_started")


async def stop() -> None:
    global _listener_task, _pubsub
    if _listener_task:
        _listener_task.cancel()
        try:
            await _listener_task
        except asyncio.CancelledError:
            pass
    if _pubsub:
        await _pubsub.unsubscribe()
        await _pubsub.aclose()
    _listener_task = None
    _pubsub = None


async def publish_cancel(redis_client, conversation_id: str) -> None:
    await redis_client.publish(f"cancel:{conversation_id}", "1")


@asynccontextmanager
async def watch_cancel(conversation_id: str):
    """Yields an asyncio.Event that is set when a cancel is received for this conversation."""
    ev = _events[conversation_id]
    ev.clear()
    try:
        yield ev
    finally:
        _events.pop(conversation_id, None)


def is_cancelled(conversation_id: str) -> bool:
    ev = _events.get(conversation_id)
    return ev is not None and ev.is_set()
