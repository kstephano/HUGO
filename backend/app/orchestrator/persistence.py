"""DB persistence helpers used by the agent loop."""
from __future__ import annotations
import uuid
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from app.db.models import Conversation, Message
from app.core.logging import get_logger

log = get_logger(__name__)


async def load_conversation(db: AsyncSession, conversation_id: str, user_id: str) -> Conversation | None:
    stmt = (
        select(Conversation)
        .where(Conversation.id == conversation_id, Conversation.user_id == user_id)
        .options(selectinload(Conversation.messages))
    )
    result = await db.execute(stmt)
    return result.scalar_one_or_none()


async def save_user_message(
    db: AsyncSession,
    conversation_id: str,
    content: str,
    client_message_id: str | None = None,
) -> Message:
    msg = Message(
        id=str(uuid.uuid4()),
        conversation_id=conversation_id,
        role="user",
        content=content,
        status="completed",
        client_message_id=client_message_id,
    )
    db.add(msg)
    await db.commit()
    await db.refresh(msg)
    return msg


async def save_assistant_message(
    db: AsyncSession,
    *,
    conversation_id: str,
    content: list,
    tool_calls: dict | None,
    status: str,
    input_tokens: int,
    output_tokens: int,
    cache_read_tokens: int,
    cache_write_tokens: int,
) -> Message:
    msg = Message(
        id=str(uuid.uuid4()),
        conversation_id=conversation_id,
        role="assistant",
        content=content,
        tool_calls=tool_calls,
        status=status,
        input_tokens=input_tokens,
        output_tokens=output_tokens,
        cache_read_tokens=cache_read_tokens,
        cache_write_tokens=cache_write_tokens,
    )
    db.add(msg)
    await db.commit()
    await db.refresh(msg)
    return msg


async def update_conversation_summary(db: AsyncSession, conversation_id: str, summary: str) -> None:
    from sqlalchemy import update
    await db.execute(
        update(Conversation).where(Conversation.id == conversation_id).values(rolling_summary=summary)
    )
    await db.commit()
