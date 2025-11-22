"""Remove name field from users table

Revision ID: 0024_remove_user_name_field
Revises: 0023_add_user_first_last_name
Create Date: 2025-01-22 17:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect, text


# revision identifiers, used by Alembic.
revision: str = '0024_remove_user_name_field'
down_revision: Union[str, None] = '0023_add_user_first_last_name'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Remove name column from users table
    
    Note: We assume that migration 0023 has already migrated existing name values
    to first_name and last_name. This migration only removes the name column.
    """
    conn = op.get_bind()
    inspector = inspect(conn)
    
    # Check if users table exists
    table_names = inspector.get_table_names()
    if 'users' not in table_names:
        print("[MIGRATION 0024] users table does not exist, skipping")
        return
    
    # Get existing columns
    columns = [col['name'] for col in inspector.get_columns('users')]
    
    # Remove name column if it exists
    if 'name' in columns:
        op.execute(text("ALTER TABLE users DROP COLUMN name"))
        conn.commit()
        print("[MIGRATION 0024] Removed name column from users table")
    
    print("[MIGRATION 0024] Migration completed successfully")


def downgrade() -> None:
    """Add name column back to users table"""
    conn = op.get_bind()
    inspector = inspect(conn)
    
    if 'users' not in inspector.get_table_names():
        return
    
    columns = [col['name'] for col in inspector.get_columns('users')]
    
    # Add name column if it doesn't exist
    if 'name' not in columns:
        op.execute(text("""
            ALTER TABLE users 
            ADD COLUMN name VARCHAR(128)
        """))
        
        # Try to reconstruct name from first_name and last_name
        try:
            op.execute(text("""
                UPDATE users 
                SET name = CASE 
                    WHEN first_name IS NOT NULL AND last_name IS NOT NULL 
                    THEN first_name || ' ' || last_name
                    WHEN first_name IS NOT NULL 
                    THEN first_name
                    WHEN last_name IS NOT NULL 
                    THEN last_name
                    ELSE NULL
                END
                WHERE name IS NULL
            """))
        except Exception as e:
            print(f"[MIGRATION 0024] Warning: Could not reconstruct name values: {e}")
        
        conn.commit()
        print("[MIGRATION 0024] Added name column back to users table")

