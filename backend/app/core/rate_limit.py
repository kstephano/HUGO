"""Sliding-window rate limiter: 60 messages per minute per user (Redis job #3)."""
from __future__ import annotations
import time
from app.core.config import get_settings
from app.core.logging import get_logger

log = get_logger(__name__)


async def check_rate_limit(redis_client, user_id: str) -> bool:
    """Returns True if allowed, False if rate limited. Fails open on Redis errors."""
    settings = get_settings()
    limit = settings.rate_limit_messages_per_minute
    window = 60
    now = time.time()
    key = f"rl:{user_id}"

    try:
        pipe = redis_client.pipeline()
        pipe.zremrangebyscore(key, 0, now - window)
        pipe.zadd(key, {str(now): now})
        pipe.zcard(key)
        pipe.expire(key, window + 1)
        results = await pipe.execute()
        count = results[2]
        if count > limit:
            log.warning("rate_limited", user_id=user_id, count=count)
            return False
        return True
    except Exception as exc:
        log.warning("rate_limit_redis_error", user_id=user_id, error=str(exc))
        return True  # fail open
