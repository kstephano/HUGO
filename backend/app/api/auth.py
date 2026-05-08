"""
Dev login endpoint: upsert user, issue HTTP-only session cookie via Redis (job #7).
Replace with real OAuth/OIDC in production.
"""
from __future__ import annotations
import secrets
import uuid
from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.config import get_settings
from app.core.dependencies import get_current_user_id, get_db, get_redis_dep
from app.db.models import User
from app.schemas.auth import DevLoginRequest, SessionResponse

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/dev-login", response_model=SessionResponse)
async def dev_login(
    payload: DevLoginRequest,
    response: Response,
    db: AsyncSession = Depends(get_db),
    redis=Depends(get_redis_dep),
):
    settings = get_settings()

    # Upsert user
    result = await db.execute(select(User).where(User.email == payload.email))
    user = result.scalar_one_or_none()
    if user is None:
        user = User(id=str(uuid.uuid4()), email=payload.email, display_name=payload.display_name)
        db.add(user)
        await db.commit()
        await db.refresh(user)

    # Create session token
    token = secrets.token_urlsafe(32)
    try:
        await redis.setex(f"session:{token}", settings.session_ttl_seconds, user.id)
    except Exception:
        raise HTTPException(status_code=503, detail="Session store unavailable")

    response.set_cookie(
        key="session_token",
        value=token,
        httponly=True,
        samesite="lax",
        max_age=settings.session_ttl_seconds,
        secure=settings.production,
    )
    return SessionResponse(user_id=user.id, email=user.email, display_name=user.display_name)


@router.post("/logout")
async def logout(
    response: Response,
    user_id: str = Depends(get_current_user_id),
    redis=Depends(get_redis_dep),
):
    # Best-effort cookie deletion; session key cleanup handled by TTL
    response.delete_cookie("session_token")
    return {"ok": True}


@router.get("/me", response_model=SessionResponse)
async def me(
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")
    return SessionResponse(user_id=user.id, email=user.email, display_name=user.display_name)
