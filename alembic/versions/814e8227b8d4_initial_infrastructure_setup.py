"""initial_infrastructure_setup.

Revision ID: 814e8227b8d4
Revises:
Create Date: 2026-10-17 18:20:50.578102
"""

from collections.abc import Sequence

# revision identifiers, used by Alembic.
revision: str = "814e8227b8d4"
down_revision: str | Sequence[str] | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Upgrade schema."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass
