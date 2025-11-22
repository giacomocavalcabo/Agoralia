"""Add first_name and last_name to users table

Revision ID: 0023_add_user_first_last_name
Revises: 0022_add_kb_created_by_fields
Create Date: 2025-01-22 16:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect, text


# revision identifiers, used by Alembic.
revision: str = '0023_add_user_first_last_name'
down_revision: Union[str, None] = '0022_add_kb_created_by_fields'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add first_name and last_name columns to users table"""
    conn = op.get_bind()
    inspector = inspect(conn)
    
    # Check if users table exists
    table_names = inspector.get_table_names()
    if 'users' not in table_names:
        print("[MIGRATION 0023] users table does not exist, skipping")
        return
    
    # Get existing columns
    columns = [col['name'] for col in inspector.get_columns('users')]
    
    # Add first_name if not exists
    if 'first_name' not in columns:
        op.execute(text("""
            ALTER TABLE users 
            ADD COLUMN first_name VARCHAR(64)
        """))
        conn.commit()
        print("[MIGRATION 0023] Added first_name column")
    
    # Add last_name if not exists
    if 'last_name' not in columns:
        op.execute(text("""
            ALTER TABLE users 
            ADD COLUMN last_name VARCHAR(64)
        """))
        conn.commit()
        print("[MIGRATION 0023] Added last_name column")
    
    # Try to split existing name field into first_name and last_name
    # This is best-effort - we'll try to split by space
    try:
        op.execute(text("""
            UPDATE users 
            SET first_name = SPLIT_PART(name, ' ', 1),
                last_name = CASE 
                    WHEN POSITION(' ' IN name) > 0 
                    THEN SUBSTRING(name FROM POSITION(' ' IN name) + 1)
                    ELSE NULL
                END
            WHERE name IS NOT NULL 
                AND name != ''
                AND (first_name IS NULL OR first_name = '')
        """))
        conn.commit()
        print("[MIGRATION 0023] Migrated existing name values to first_name/last_name")
    except Exception as e:
        print(f"[MIGRATION 0023] Warning: Could not migrate existing name values: {e}")
        # Continue anyway - it's not critical
    
    print("[MIGRATION 0023] Migration completed successfully")


def downgrade() -> None:
    """Remove first_name and last_name columns from users table"""
    conn = op.get_bind()
    inspector = inspect(conn)
    
    if 'users' not in inspector.get_table_names():
        return
    
    columns = [col['name'] for col in inspector.get_columns('users')]
    
    # Remove columns if they exist
    if 'first_name' in columns:
        op.execute(text("ALTER TABLE users DROP COLUMN first_name"))
        conn.commit()
    
    if 'last_name' in columns:
        op.execute(text("ALTER TABLE users DROP COLUMN last_name"))
        conn.commit()

