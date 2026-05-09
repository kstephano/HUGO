"""Conversation and message CRUD REST endpoints."""
from __future__ import annotations
import uuid
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from app.core.dependencies import get_current_user_id, get_db
from app.db.models import Conversation, Message
from app.schemas.conversations import ConversationCreate, ConversationList, ConversationOut
from app.schemas.messages import MessageList, MessageOut

router = APIRouter(prefix="/conversations", tags=["conversations"])


@router.delete("", status_code=204)
async def delete_all_conversations(
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Delete all conversations belonging to the current user."""
    await db.execute(delete(Conversation).where(Conversation.user_id == user_id))
    await db.commit()


@router.post("", response_model=ConversationOut, status_code=201)
async def create_conversation(
    payload: ConversationCreate,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    conv = Conversation(id=str(uuid.uuid4()), user_id=user_id, title=payload.title)
    db.add(conv)
    await db.commit()
    await db.refresh(conv)
    return conv


@router.get("", response_model=ConversationList)
async def list_conversations(
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
    limit: int = 20,
    offset: int = 0,
):
    count_stmt = select(func.count()).where(Conversation.user_id == user_id)
    total = (await db.execute(count_stmt)).scalar_one()

    stmt = (
        select(Conversation)
        .where(Conversation.user_id == user_id)
        .order_by(Conversation.updated_at.desc())
        .limit(limit)
        .offset(offset)
    )
    items = (await db.execute(stmt)).scalars().all()
    return ConversationList(items=list(items), total=total)


@router.get("/{conversation_id}", response_model=ConversationOut)
async def get_conversation(
    conversation_id: str,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    stmt = select(Conversation).where(
        Conversation.id == conversation_id,
        Conversation.user_id == user_id,
    )
    conv = (await db.execute(stmt)).scalar_one_or_none()
    if conv is None:
        raise HTTPException(status_code=404, detail="Conversation not found")
    return conv


@router.delete("/{conversation_id}", status_code=204)
async def delete_conversation(
    conversation_id: str,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    stmt = select(Conversation).where(
        Conversation.id == conversation_id,
        Conversation.user_id == user_id,
    )
    conv = (await db.execute(stmt)).scalar_one_or_none()
    if conv is None:
        raise HTTPException(status_code=404, detail="Conversation not found")
    await db.delete(conv)
    await db.commit()


@router.get("/{conversation_id}/messages", response_model=MessageList)
async def list_messages(
    conversation_id: str,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
    limit: int = 50,
    offset: int = 0,
):
    # Verify ownership
    conv_stmt = select(Conversation).where(
        Conversation.id == conversation_id,
        Conversation.user_id == user_id,
    )
    conv = (await db.execute(conv_stmt)).scalar_one_or_none()
    if conv is None:
        raise HTTPException(status_code=404, detail="Conversation not found")

    count_stmt = select(func.count()).where(Message.conversation_id == conversation_id)
    total = (await db.execute(count_stmt)).scalar_one()

    stmt = (
        select(Message)
        .where(Message.conversation_id == conversation_id)
        .order_by(Message.created_at.asc())
        .limit(limit)
        .offset(offset)
    )
    items = (await db.execute(stmt)).scalars().all()
    return MessageList(items=list(items), total=total)
