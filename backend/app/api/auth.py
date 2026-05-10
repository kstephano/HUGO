"""
Auth endpoints: Google Sign-In, dev login, session management.
"""
from __future__ import annotations
import secrets
import uuid
import httpx
from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.config import get_settings
from app.core.dependencies import get_current_user_id, get_db, get_redis_dep
from app.core.security import hash_password, verify_password
from app.db.models import User
from app.schemas.auth import (
    DevLoginRequest, EmailLoginRequest, EmailRegisterRequest,
    GoogleLoginRequest, SessionResponse, SettingsUpdateRequest,
)

router = APIRouter(prefix="/auth", tags=["auth"])


def _session_response(user: User) -> SessionResponse:
    return SessionResponse(
        user_id=user.id,
        email=user.email,
        display_name=user.display_name,
        remember_conversations=user.remember_conversations,
    )


async def _create_session(user: User, response: Response, redis, settings) -> None:
    token = secrets.token_urlsafe(32)
    try:
        await redis.setex(f"session:{token}", settings.session_ttl_seconds, user.id)
    except Exception:
        raise HTTPException(status_code=503, detail="Session store unavailable")
    response.set_cookie(
        key="session_token",
        value=token,
        httponly=True,
        samesite="none" if settings.production else "lax",
        max_age=settings.session_ttl_seconds,
        secure=settings.production,
    )


@router.post("/google", response_model=SessionResponse)
async def google_login(
    payload: GoogleLoginRequest,
    response: Response,
    db: AsyncSession = Depends(get_db),
    redis=Depends(get_redis_dep),
):
    """Verify a Google ID token and create (or resume) a session."""
    settings = get_settings()

    # Verify token with Google's tokeninfo endpoint
    async with httpx.AsyncClient() as client:
        r = await client.get(
            "https://oauth2.googleapis.com/tokeninfo",
            params={"id_token": payload.credential},
            timeout=10.0,
        )
    if r.status_code != 200:
        raise HTTPException(status_code=401, detail="Invalid Google token")

    token_data = r.json()
    if settings.google_client_id and token_data.get("aud") != settings.google_client_id:
        raise HTTPException(status_code=401, detail="Token audience mismatch")

    google_id = token_data.get("sub")
    email = token_data.get("email", "")
    name = token_data.get("name") or token_data.get("given_name") or email.split("@")[0]

    # Find user by google_id first, then fall back to email
    result = await db.execute(select(User).where(User.google_id == google_id))
    user = result.scalar_one_or_none()

    if user is None:
        result = await db.execute(select(User).where(User.email == email))
        user = result.scalar_one_or_none()

    if user is None:
        user = User(id=str(uuid.uuid4()), email=email, display_name=name, google_id=google_id)
        db.add(user)
    else:
        if user.google_id is None:
            user.google_id = google_id
        if user.display_name != name and name:
            user.display_name = name

    await db.commit()
    await db.refresh(user)
    await _create_session(user, response, redis, settings)
    return _session_response(user)


@router.post("/register", response_model=SessionResponse, status_code=201)
async def email_register(
    payload: EmailRegisterRequest,
    response: Response,
    db: AsyncSession = Depends(get_db),
    redis=Depends(get_redis_dep),
):
    """Create a new account with email and password.

    If the email belongs to an existing Google/dev account with no password,
    we attach the password to that account rather than rejecting the request.
    """
    settings = get_settings()
    result = await db.execute(select(User).where(User.email == payload.email))
    user = result.scalar_one_or_none()

    if user is not None:
        if user.password_hash is not None:
            raise HTTPException(status_code=409, detail="An account with this email already exists")
        # Existing account has no password (Google/dev) — attach the password
        user.password_hash = hash_password(payload.password)
        await db.commit()
        await db.refresh(user)
    else:
        user = User(
            id=str(uuid.uuid4()),
            email=payload.email,
            display_name=payload.display_name,
            password_hash=hash_password(payload.password),
        )
        db.add(user)
        await db.commit()
        await db.refresh(user)
    await _create_session(user, response, redis, settings)
    return _session_response(user)


@router.post("/login", response_model=SessionResponse)
async def email_login(
    payload: EmailLoginRequest,
    response: Response,
    db: AsyncSession = Depends(get_db),
    redis=Depends(get_redis_dep),
):
    """Sign in with email and password."""
    settings = get_settings()
    result = await db.execute(select(User).where(User.email == payload.email))
    user = result.scalar_one_or_none()
    if user is None or not user.password_hash or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    await _create_session(user, response, redis, settings)
    return _session_response(user)


@router.post("/dev-login", response_model=SessionResponse)
async def dev_login(
    payload: DevLoginRequest,
    response: Response,
    db: AsyncSession = Depends(get_db),
    redis=Depends(get_redis_dep),
):
    settings = get_settings()
    result = await db.execute(select(User).where(User.email == payload.email))
    user = result.scalar_one_or_none()
    if user is None:
        user = User(id=str(uuid.uuid4()), email=payload.email, display_name=payload.display_name)
        db.add(user)
        await db.commit()
        await db.refresh(user)
    await _create_session(user, response, redis, settings)
    return _session_response(user)


@router.patch("/settings", response_model=SessionResponse)
async def update_settings(
    payload: SettingsUpdateRequest,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")
    user.remember_conversations = payload.remember_conversations
    await db.commit()
    await db.refresh(user)
    return _session_response(user)


@router.post("/logout")
async def logout(
    response: Response,
    user_id: str = Depends(get_current_user_id),
    redis=Depends(get_redis_dep),
):
    response.delete_cookie("session_token")
    return {"ok": True}


@router.get("/ws-ticket")
async def ws_ticket(
    user_id: str = Depends(get_current_user_id),
    redis=Depends(get_redis_dep),
):
    """Issue a short-lived one-time ticket for WebSocket auth (cross-origin proxy workaround)."""
    ticket = secrets.token_urlsafe(32)
    try:
        await redis.setex(f"ws_ticket:{ticket}", 60, user_id)
    except Exception:
        raise HTTPException(status_code=503, detail="Session store unavailable")
    return {"ticket": ticket}


@router.get("/me", response_model=SessionResponse)
async def me(
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")
    return _session_response(user)
