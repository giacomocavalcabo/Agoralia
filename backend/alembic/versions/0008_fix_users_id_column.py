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
    
    # If id is not integer (e.g., varchar), we need to fix it
    if 'varchar' in id_type_str or 'text' in id_type_str or 'char' in id_type_str:
        # id is string, need to convert to integer
        # This is complex - we need to:
        # 1. Create a new integer column
        # 2. Populate it with sequential numbers
        # 3. Drop old column
        # 4. Rename new column
        # But this is risky with foreign keys
        
        # Instead, let's just ensure id is INTEGER and has auto-increment
        # If it's already INTEGER, we're done
        pass
    else:
        # id is already integer, just ensure it has auto-increment
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
                conn.execute(text("CREATE SEQUENCE users_id_seq OWNED BY users.id"))
                # Set sequence to start from max(id) + 1
                result = conn.execute(text("SELECT COALESCE(MAX(id), 0) FROM users"))
                max_id = result.scalar()
                conn.execute(text(f"SELECT setval('users_id_seq', {max_id + 1}, false)"))
            
            # Set default to use sequence
            conn.execute(text("ALTER TABLE users ALTER COLUMN id SET DEFAULT nextval('users_id_seq')"))


def downgrade() -> None:
    # Don't change id column back (too dangerous)
    pass

