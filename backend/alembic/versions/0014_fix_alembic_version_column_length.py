"""Fix alembic_version.version_num column length

Revision ID: 0014_fix_alembic_version_column_length
Revises: 0013_add_retell_agent_id
Create Date: 2025-01-15 16:30:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect, text


# revision identifiers, used by Alembic.
revision = '0014_fix_alembic_version_column_length'
down_revision = '0013_add_retell_agent_id'
branch_labels = None
depends_on = None


def upgrade() -> None:
    conn = op.get_bind()
    inspector = inspect(conn)
    
    # Check if alembic_version table exists
    if 'alembic_version' in inspector.get_table_names():
        # Get current column definition
        columns = {col['name']: col for col in inspector.get_columns('alembic_version')}
        
        if 'version_num' in columns:
            version_num_col = columns['version_num']
            # Check if column is VARCHAR(32) or shorter
            if hasattr(version_num_col['type'], 'length') and version_num_col['type'].length and version_num_col['type'].length <= 32:
                # Alter column to VARCHAR(128) to accommodate longer revision names
                op.alter_column(
                    'alembic_version',
                    'version_num',
                    existing_type=sa.String(version_num_col['type'].length or 32),
                    type_=sa.String(128),
                    existing_nullable=False
                )


def downgrade() -> None:
    # Don't downgrade - would risk truncation
    pass

