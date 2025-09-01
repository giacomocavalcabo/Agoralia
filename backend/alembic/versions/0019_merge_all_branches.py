"""Merge all branches

Revision ID: 0019_merge_all_branches
Revises: 0004, 0005, 0007_kb_constraints_indexes, 0008, 0009_auth_complete_sprint11, 0018_compliance
Create Date: 2025-01-27 16:30:00.000000

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '0019_merge_all_branches'
down_revision = ('0004', '0005', '0007_kb_constraints_indexes', '0008', '0009_auth_complete_sprint11', '0018_compliance')
branch_labels = None
depends_on = None

def upgrade():
    # This is a merge migration - no schema changes needed
    pass

def downgrade():
    # This is a merge migration - no schema changes needed
    pass
