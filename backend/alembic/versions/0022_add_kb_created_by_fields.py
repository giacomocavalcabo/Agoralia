"""Add created_by_user_id and created_by_user_name to kbs table

Revision ID: 0022_add_kb_created_by_fields
Revises: 0021_extend_knowledge_base_with_retellai_fields
Create Date: 2025-01-22 15:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect, text


# revision identifiers, used by Alembic.
revision: str = '0022_add_kb_created_by_fields'
down_revision: Union[str, None] = '0021_extend_knowledge_base_with_retellai_fields'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add created_by_user_id and created_by_user_name columns to kbs table"""
    conn = op.get_bind()
    inspector = inspect(conn)
    
    # Check if kbs table exists
    table_names = inspector.get_table_names()
    if 'kbs' not in table_names:
        print("[MIGRATION 0022] kbs table does not exist, skipping")
        return
    
    # Get existing columns
    columns = [col['name'] for col in inspector.get_columns('kbs')]
    
    # Add created_by_user_id if not exists
    if 'created_by_user_id' not in columns:
        op.execute(text("""
            ALTER TABLE kbs 
            ADD COLUMN created_by_user_id INTEGER
        """))
        conn.commit()
        print("[MIGRATION 0022] Added created_by_user_id column")
    
    # Add created_by_user_name if not exists
    if 'created_by_user_name' not in columns:
        op.execute(text("""
            ALTER TABLE kbs 
            ADD COLUMN created_by_user_name VARCHAR(128)
        """))
        conn.commit()
        print("[MIGRATION 0022] Added created_by_user_name column")
    
    print("[MIGRATION 0022] Migration completed successfully")


def downgrade() -> None:
    """Remove created_by_user_id and created_by_user_name columns from kbs table"""
    conn = op.get_bind()
    inspector = inspect(conn)
    
    if 'kbs' not in inspector.get_table_names():
        return
    
    columns = [col['name'] for col in inspector.get_columns('kbs')]
    
    # Remove columns if they exist
    if 'created_by_user_id' in columns:
        op.execute(text("ALTER TABLE kbs DROP COLUMN created_by_user_id"))
        conn.commit()
    
    if 'created_by_user_name' in columns:
        op.execute(text("ALTER TABLE kbs DROP COLUMN created_by_user_name"))
        conn.commit()

