"""Async SQLAlchemy engine and session factory using NullPool for serverless-safe connections."""
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import NullPool
from app.core.config import get_settings

settings = get_settings()

engine = create_async_engine(
    settings.async_database_url,
    echo=settings.db_echo,
    poolclass=NullPool,
    # NullPool ignores pool_size/max_overflow — swap to AsyncAdaptedQueuePool
    # and set pool_size=10, max_overflow=20 for long-running server deployments.
)

AsyncSessionLocal = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
)
