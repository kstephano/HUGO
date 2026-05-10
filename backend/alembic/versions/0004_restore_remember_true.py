"""restore remember_conversations default and existing users to true

Revision ID: 0004
Revises: 0003
Create Date: 2026-05-10
"""
from __future__ import annotations
from alembic import op
import sqlalchemy as sa

revision = "0004"
down_revision = "0003"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.alter_column(
        "users",
        "remember_conversations",
        server_default="true",
        existing_type=sa.Boolean(),
        existing_nullable=False,
    )
    op.execute("UPDATE users SET remember_conversations = true")


def downgrade() -> None:
    op.alter_column(
        "users",
        "remember_conversations",
        server_default="false",
        existing_type=sa.Boolean(),
        existing_nullable=False,
    )
