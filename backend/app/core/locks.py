"""Distributed tool locks via Redis SET NX EX; fails open on Redis errors."""
from __future__ import annotations
import asyncio
from contextlib import asynccontextmanager
from app.core.logging import get_logger

log = get_logger(__name__)

LOCK_TTL = 60  # seconds


@asynccontextmanager
async def acquire_tool_lock(redis_client, lock_key: str):
    """Acquires a distributed lock; yields True if acquired, False if already held."""
    full_key = f"tool_lock:{lock_key}"
    acquired = False
    try:
        acquired = await redis_client.set(full_key, "1", nx=True, ex=LOCK_TTL)
    except Exception as exc:
        log.warning("tool_lock_redis_error", key=lock_key, error=str(exc))
        acquired = True  # fail open

    try:
        yield bool(acquired)
    finally:
        if acquired:
            try:
                await redis_client.delete(full_key)
            except Exception as exc:
                log.warning("tool_lock_release_error", key=lock_key, error=str(exc))
