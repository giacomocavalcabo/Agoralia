"""Merge branches at 0016

Revision ID: 0016_merge_branches
Revises: 0016_history_indexes, 0016_telephony_providers
Create Date: 2025-01-27 16:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '0016_merge_branches'
down_revision = ('0016_history_indexes', '0016_telephony_providers')
branch_labels = None
depends_on = None

def upgrade():
    # This is a merge migration - no schema changes needed
    pass

def downgrade():
    # This is a merge migration - no schema changes needed
    pass
