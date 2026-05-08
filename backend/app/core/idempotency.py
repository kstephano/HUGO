"""
Idempotency key store (Redis job #4): prevents double-processing of retried messages.
Keys expire after 24 hours. Fails open on Redis errors.
"""
from __future__ import annotations
from app.core.logging import get_logger

log = get_logger(__name__)

_TTL = 86400  # 24 hours


async def is_duplicate(redis_client, client_message_id: str) -> bool:
    """Returns True if this client_message_id was already processed."""
    key = f"idem:{client_message_id}"
    try:
        result = await redis_client.set(key, "1", nx=True, ex=_TTL)
        # SET NX returns None if key already existed
        return result is None
    except Exception as exc:
        log.warning("idempotency_redis_error", client_message_id=client_message_id, error=str(exc))
        return False  # fail open: allow processing
