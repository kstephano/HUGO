"""
Shared fixtures: in-process SQLite (async), mock Redis, FastAPI test client.
MOCK_PROVIDERS=true is enforced so no external calls are made.
"""
from __future__ import annotations
import os
import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import StaticPool
from unittest.mock import AsyncMock, MagicMock

os.environ.setdefault("MOCK_PROVIDERS", "true")
os.environ.setdefault("ANTHROPIC_API_KEY", "test")
os.environ.setdefault("VOYAGE_API_KEY", "test")
os.environ.setdefault("SESSION_SECRET", "test-secret")
os.environ.setdefault("DATABASE_URL", "sqlite+aiosqlite:///:memory:")
os.environ.setdefault("REDIS_URL", "redis://localhost:6379/0")

from app.db.models import Base
from app.db.session import AsyncSessionLocal
from app.core.dependencies import get_db, get_redis_dep
from app.main import app


@pytest_asyncio.fixture
async def db_engine():
    engine = create_async_engine(
        "sqlite+aiosqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield engine
    await engine.dispose()


@pytest_asyncio.fixture
async def db(db_engine):
    SessionLocal = async_sessionmaker(db_engine, class_=AsyncSession, expire_on_commit=False)
    async with SessionLocal() as session:
        yield session


@pytest_asyncio.fixture
def mock_redis():
    redis = MagicMock()
    redis.get = AsyncMock(return_value=None)
    redis.set = AsyncMock(return_value=True)
    redis.setex = AsyncMock(return_value=True)
    redis.delete = AsyncMock(return_value=1)
    redis.publish = AsyncMock(return_value=1)
    redis.zremrangebyscore = AsyncMock(return_value=0)
    redis.zadd = AsyncMock(return_value=1)
    redis.zcard = AsyncMock(return_value=1)
    redis.expire = AsyncMock(return_value=True)
    redis.pipeline = MagicMock(return_value=redis)
    redis.execute = AsyncMock(return_value=[0, 1, 1, True])
    return redis


@pytest_asyncio.fixture
async def client(db, mock_redis):
    app.dependency_overrides[get_db] = lambda: db
    app.dependency_overrides[get_redis_dep] = lambda: mock_redis
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        yield c
    app.dependency_overrides.clear()


@pytest_asyncio.fixture
async def authed_client(db, mock_redis):
    """Client with a pre-set session cookie pointing to a seeded user."""
    import uuid
    from app.db.models import User

    user = User(id=str(uuid.uuid4()), email="test@test.com", display_name="Tester")
    db.add(user)
    await db.commit()

    mock_redis.get = AsyncMock(return_value=user.id)

    app.dependency_overrides[get_db] = lambda: db
    app.dependency_overrides[get_redis_dep] = lambda: mock_redis

    async with AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://test",
        cookies={"session_token": "test-token"},
    ) as c:
        yield c, user

    app.dependency_overrides.clear()
