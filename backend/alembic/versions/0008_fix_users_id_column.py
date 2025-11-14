"""Fix users.id column to be INTEGER with auto-increment

Revision ID: 0008_fix_users_id_column
Revises: 0007_fix_users_columns
Create Date: 2024-11-14 15:35:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect, text


# revision identifiers, used by Alembic.
revision = '0008_fix_users_id_column'
down_revision = '0007_fix_users_columns'
branch_labels = None
depends_on = None


def upgrade() -> None:
    conn = op.get_bind()
    inspector = inspect(conn)
    
    if 'users' not in inspector.get_table_names():
        return  # Table doesn't exist
    
    # Check if there's a sequence for id
    result = conn.execute(text("""
        SELECT EXISTS (
            SELECT 1 FROM pg_class 
            WHERE relname = 'users_id_seq'
        )
    """))
    seq_exists = result.scalar()
    
    if not seq_exists:
        # Create sequence first
        conn.execute(text("CREATE SEQUENCE users_id_seq OWNED BY users.id"))
        
        # Get current max id (if any users exist)
        result = conn.execute(text("SELECT COALESCE(MAX(CAST(id AS INTEGER)), 0) FROM users WHERE id ~ '^[0-9]+$'"))
        max_id = result.scalar() or 0
        
        # Also check if there are any non-numeric ids
        result = conn.execute(text("SELECT COUNT(*) FROM users WHERE id !~ '^[0-9]+$' OR id IS NULL"))
        non_numeric_count = result.scalar() or 0
        
        # Set sequence to start from max_id + 1 (or 1 if no users or all non-numeric)
        start_val = max(max_id, 0) + 1 if max_id > 0 or non_numeric_count == 0 else 1
        conn.execute(text(f"SELECT setval('users_id_seq', {start_val}, false)"))
    else:
        # Sequence exists, check if it needs to be updated
        result = conn.execute(text("SELECT COALESCE(MAX(CAST(id AS INTEGER)), 0) FROM users WHERE id ~ '^[0-9]+$'"))
        max_id = result.scalar() or 0
        if max_id > 0:
            # Update sequence to be at least max_id + 1
            conn.execute(text(f"SELECT setval('users_id_seq', GREATEST({max_id + 1}, nextval('users_id_seq')::bigint), false)"))
    
    # Check current default
    result = conn.execute(text("""
        SELECT column_default 
        FROM information_schema.columns 
        WHERE table_name = 'users' AND column_name = 'id'
    """))
    row = result.fetchone()
    default = row[0] if row else None
    
    # If there's no auto-increment default, set it
    if not default or 'nextval' not in str(default).lower():
        # Ensure sequence exists (should already exist from above, but double-check)
        result = conn.execute(text("""
            SELECT EXISTS (
                SELECT 1 FROM pg_class 
                WHERE relname = 'users_id_seq'
            )
        """))
        if not result.scalar():
            conn.execute(text("CREATE SEQUENCE users_id_seq OWNED BY users.id"))
            conn.execute(text("SELECT setval('users_id_seq', 1, false)"))
        
        # Set default to use sequence
        conn.execute(text("ALTER TABLE users ALTER COLUMN id SET DEFAULT nextval('users_id_seq')"))


def downgrade() -> None:
    # Don't change id column back (too dangerous)
    pass

