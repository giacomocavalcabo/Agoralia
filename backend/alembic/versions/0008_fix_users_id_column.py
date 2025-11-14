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
    
    # Check the current type of id column
    id_column = None
    for col in inspector.get_columns('users'):
        if col['name'] == 'id':
            id_column = col
            break
    
    if not id_column:
        return  # No id column found
    
    id_type_str = str(id_column['type']).lower()
    
    # Ensure id column has auto-increment
    # Check if there's a sequence for it
    result = conn.execute(text("""
        SELECT column_default 
        FROM information_schema.columns 
        WHERE table_name = 'users' AND column_name = 'id'
    """))
    row = result.fetchone()
    default = row[0] if row else None
    
    # If there's no auto-increment sequence, create one
    if not default or 'nextval' not in str(default).lower():
        # Check if sequence exists
        result = conn.execute(text("""
            SELECT EXISTS (
                SELECT 1 FROM pg_class 
                WHERE relname = 'users_id_seq'
            )
        """))
        seq_exists = result.scalar()
        
        if not seq_exists:
            # Create sequence
            conn.execute(text("CREATE SEQUENCE IF NOT EXISTS users_id_seq OWNED BY users.id"))
            # Set sequence to start from max(id) + 1 (or 1 if no users)
            result = conn.execute(text("SELECT COALESCE(MAX(id)::bigint, 0) FROM users"))
            max_id = result.scalar()
            if max_id is None or max_id == 0:
                # Start from 1
                conn.execute(text("SELECT setval('users_id_seq', 1, false)"))
            else:
                # Start from max_id + 1
                conn.execute(text(f"SELECT setval('users_id_seq', {max_id + 1}, false)"))
        
        # Set default to use sequence
        conn.execute(text("ALTER TABLE users ALTER COLUMN id SET DEFAULT nextval('users_id_seq')"))


def downgrade() -> None:
    # Don't change id column back (too dangerous)
    pass

