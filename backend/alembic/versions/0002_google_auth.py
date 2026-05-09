"""add google_id and remember_conversations to users

Revision ID: 0002
Revises: 0001
Create Date: 2026-05-09
"""
from __future__ import annotations
from alembic import op
import sqlalchemy as sa

revision = "0002"
down_revision = "0001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("users", sa.Column("google_id", sa.String(255), nullable=True))
    op.create_unique_constraint("uq_users_google_id", "users", ["google_id"])
    op.add_column(
        "users",
        sa.Column("remember_conversations", sa.Boolean(), nullable=False, server_default="true"),
    )


def downgrade() -> None:
    op.drop_constraint("uq_users_google_id", "users", type_="unique")
    op.drop_column("users", "google_id")
    op.drop_column("users", "remember_conversations")
