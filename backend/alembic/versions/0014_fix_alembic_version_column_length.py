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
            col_type = version_num_col['type']
            col_length = None
            
            # Get length from type
            if hasattr(col_type, 'length'):
                col_length = col_type.length
            elif str(col_type).startswith('VARCHAR'):
                # Extract length from string like 'VARCHAR(32)'
                import re
                match = re.search(r'\((\d+)\)', str(col_type))
                if match:
                    col_length = int(match.group(1))
            
            if col_length and col_length <= 32:
                # Alter column to VARCHAR(128) to accommodate longer revision names
                op.alter_column(
                    'alembic_version',
                    'version_num',
                    existing_type=sa.String(col_length),
                    type_=sa.String(128),
                    existing_nullable=False
                )


def downgrade() -> None:
    # Don't downgrade - would risk truncation
    pass

