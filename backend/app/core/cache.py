"""
Hot conversation cache: read-through / write-through with 1-hour TTL.
Postgres is the source of truth; Redis is best-effort (fail-open on all errors).
"""
from __future__ import annotations
import asyncio
import json
from typing import Any
from app.core.logging import get_logger

log = get_logger(__name__)

_TTL = 3600  # 1 hour


def _key(conversation_id: str) -> str:
    return f"conv:{conversation_id}"


async def get_conversation(redis_client, conversation_id: str) -> dict | None:
    try:
        raw = await redis_client.get(_key(conversation_id))
        if raw:
            return json.loads(raw)
    except Exception as exc:
        log.warning("cache_get_error", conversation_id=conversation_id, error=str(exc))
    return None


def _bg_set(redis_client, conversation_id: str, data: dict) -> None:
    async def _do():
        try:
            await redis_client.setex(_key(conversation_id), _TTL, json.dumps(data))
        except Exception as exc:
            log.warning("cache_set_error", conversation_id=conversation_id, error=str(exc))

    asyncio.create_task(_do())


def set_conversation(redis_client, conversation_id: str, data: dict) -> None:
    """Fire-and-forget write-through; never awaited by caller."""
    _bg_set(redis_client, conversation_id, data)


async def invalidate_conversation(redis_client, conversation_id: str) -> None:
    try:
        await redis_client.delete(_key(conversation_id))
    except Exception as exc:
        log.warning("cache_invalidate_error", conversation_id=conversation_id, error=str(exc))
