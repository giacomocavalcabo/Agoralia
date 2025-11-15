"""add retell_kb_id to kbs

Revision ID: 0016_add_retell_kb_id_to_kbs
Revises: 0015_add_lead_quiet_hours_disabled
Create Date: 2025-01-15 12:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '0016_add_retell_kb_id_to_kbs'
down_revision: Union[str, None] = '0015_add_lead_quiet_hours_disabled'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add retell_kb_id column to kbs table
    op.add_column('kbs', sa.Column('retell_kb_id', sa.String(length=128), nullable=True))


def downgrade() -> None:
    # Remove retell_kb_id column from kbs table
    op.drop_column('kbs', 'retell_kb_id')

