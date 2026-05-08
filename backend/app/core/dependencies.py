"""FastAPI dependency functions for DB session, Redis, and current user."""
from __future__ import annotations
from typing import AsyncGenerator
import redis.asyncio as aioredis
from fastapi import Cookie, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.redis import get_redis
from app.db.session import AsyncSessionLocal


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with AsyncSessionLocal() as session:
        try:
            yield session
        except Exception:
            await session.rollback()
            raise


async def get_redis_dep() -> aioredis.Redis:
    return await get_redis()


async def get_current_user_id(
    session_token: str | None = Cookie(default=None),
    redis: aioredis.Redis = Depends(get_redis_dep),
) -> str:
    """Reads the HTTP-only session cookie and resolves to user_id; 401 on failure."""
    if not session_token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")
    try:
        user_id = await redis.get(f"session:{session_token}")
    except Exception:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Session store unavailable")
    if not user_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Session expired")
    return user_id
