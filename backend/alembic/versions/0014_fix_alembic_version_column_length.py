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
        # Use raw SQL to alter column - more reliable than op.alter_column for type changes
        # First check current column type
        result = conn.execute(text("""
            SELECT character_maximum_length 
            FROM information_schema.columns 
            WHERE table_name = 'alembic_version' 
            AND column_name = 'version_num'
        """))
        row = result.fetchone()
        
        if row and row[0] and row[0] <= 32:
            # Column is VARCHAR(32) or shorter - need to expand to VARCHAR(128)
            conn.execute(text("ALTER TABLE alembic_version ALTER COLUMN version_num TYPE VARCHAR(128)"))
            conn.commit()


def downgrade() -> None:
    # Don't downgrade - would risk truncation
    pass

