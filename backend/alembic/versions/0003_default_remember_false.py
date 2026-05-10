"""change remember_conversations default to false

Revision ID: 0003
Revises: 0002
Create Date: 2026-05-10
"""
from __future__ import annotations
from alembic import op
import sqlalchemy as sa

revision = "0003"
down_revision = "0002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.alter_column(
        "users",
        "remember_conversations",
        server_default="false",
        existing_type=sa.Boolean(),
        existing_nullable=False,
    )
    op.execute("UPDATE users SET remember_conversations = false")


def downgrade() -> None:
    op.alter_column(
        "users",
        "remember_conversations",
        server_default="true",
        existing_type=sa.Boolean(),
        existing_nullable=False,
    )
