"""
Idempotent seed script — creates a default dev user if none exists.
Run after migrations: python -m app.seed
"""
from __future__ import annotations
import asyncio
import uuid
from sqlalchemy import select
from app.core.logging import configure_logging, get_logger
from app.db.models import User
from app.db.session import AsyncSessionLocal

configure_logging()
log = get_logger(__name__)

DEV_EMAIL = "dev@hugo.local"
DEV_NAME = "Dev User"


async def seed() -> None:
    async with AsyncSessionLocal() as db:
        result = await db.execute(select(User).where(User.email == DEV_EMAIL))
        user = result.scalar_one_or_none()
        if user is None:
            user = User(id=str(uuid.uuid4()), email=DEV_EMAIL, display_name=DEV_NAME)
            db.add(user)
            await db.commit()
            log.info("seed_user_created", email=DEV_EMAIL, user_id=user.id)
        else:
            log.info("seed_user_exists", email=DEV_EMAIL, user_id=user.id)


if __name__ == "__main__":
    asyncio.run(seed())
