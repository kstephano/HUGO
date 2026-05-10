"""SQLAlchemy ORM models — all tables in the hugo schema."""
from __future__ import annotations
import uuid
from datetime import datetime
from sqlalchemy import (
    Boolean, DateTime, ForeignKey, Index, Integer, JSON, String, Text, Uuid, func,
)
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship

# pgvector is only available when the postgres driver is loaded;
# fall back to Text so SQLite tests can create the schema.
try:
    from pgvector.sqlalchemy import Vector as _Vector
    _VECTOR_TYPE = _Vector(1024)
except Exception:
    _VECTOR_TYPE = Text()  # type: ignore[assignment]

# Uuid(as_uuid=False) renders as native UUID on PostgreSQL, CHAR on SQLite —
# matches the migration schema while keeping tests working without casting.
_UUID = Uuid(as_uuid=False)


class Base(DeclarativeBase):
    pass


class User(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(_UUID, primary_key=True, default=lambda: str(uuid.uuid4()))
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    display_name: Mapped[str] = mapped_column(String(255), nullable=False)
    google_id: Mapped[str | None] = mapped_column(String(255), unique=True, nullable=True)
    remember_conversations: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True, server_default="true")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    conversations: Mapped[list[Conversation]] = relationship(back_populates="user")


class Conversation(Base):
    __tablename__ = "conversations"

    id: Mapped[str] = mapped_column(_UUID, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    title: Mapped[str | None] = mapped_column(String(500))
    rolling_summary: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    user: Mapped[User] = relationship(back_populates="conversations")
    messages: Mapped[list[Message]] = relationship(back_populates="conversation", order_by="Message.created_at")


class Message(Base):
    __tablename__ = "messages"

    id: Mapped[str] = mapped_column(_UUID, primary_key=True, default=lambda: str(uuid.uuid4()))
    conversation_id: Mapped[str] = mapped_column(ForeignKey("conversations.id", ondelete="CASCADE"), nullable=False)
    role: Mapped[str] = mapped_column(String(20), nullable=False)
    content: Mapped[dict | list | None] = mapped_column(JSON)
    tool_calls: Mapped[dict | None] = mapped_column(JSON)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="completed")
    client_message_id: Mapped[str | None] = mapped_column(String(64), index=True)

    input_tokens: Mapped[int] = mapped_column(Integer, default=0)
    output_tokens: Mapped[int] = mapped_column(Integer, default=0)
    cache_read_tokens: Mapped[int] = mapped_column(Integer, default=0)
    cache_write_tokens: Mapped[int] = mapped_column(Integer, default=0)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    conversation: Mapped[Conversation] = relationship(back_populates="messages")


class Document(Base):
    __tablename__ = "documents"

    id: Mapped[str] = mapped_column(_UUID, primary_key=True, default=lambda: str(uuid.uuid4()))
    title: Mapped[str] = mapped_column(String(500), nullable=False)
    source_uri: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    chunks: Mapped[list[Chunk]] = relationship(back_populates="document")


class Chunk(Base):
    __tablename__ = "chunks"

    id: Mapped[str] = mapped_column(_UUID, primary_key=True, default=lambda: str(uuid.uuid4()))
    document_id: Mapped[str] = mapped_column(ForeignKey("documents.id", ondelete="CASCADE"), nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    embedding = mapped_column(_VECTOR_TYPE, nullable=True)
    chunk_index: Mapped[int] = mapped_column(Integer, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    document: Mapped[Document] = relationship(back_populates="chunks")

    __table_args__ = (
        Index("ix_chunks_embedding_hnsw", "embedding",
              postgresql_using="hnsw",
              postgresql_with={"m": 16, "ef_construction": 64},
              postgresql_ops={"embedding": "vector_cosine_ops"}),
        Index("ix_chunks_content_trgm", "content",
              postgresql_using="gin",
              postgresql_ops={"content": "gin_trgm_ops"}),
    )


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id: Mapped[str] = mapped_column(_UUID, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id: Mapped[str | None] = mapped_column(String(64))
    action: Mapped[str] = mapped_column(String(100), nullable=False)
    resource_type: Mapped[str | None] = mapped_column(String(100))
    resource_id: Mapped[str | None] = mapped_column(String(64))
    extra: Mapped[dict | None] = mapped_column("metadata", JSON)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
