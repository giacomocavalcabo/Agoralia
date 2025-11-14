"""Force users.id to be INTEGER with proper sequence

Revision ID: 0009_force_users_id_integer
Revises: 0008_fix_users_id_column
Create Date: 2024-11-14 15:40:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect, text


# revision identifiers, used by Alembic.
revision = '0009_force_users_id_integer'
down_revision = '0008_fix_users_id_column'
branch_labels = None
depends_on = None


def upgrade() -> None:
    conn = op.get_bind()
    inspector = inspect(conn)
    
    if 'users' not in inspector.get_table_names():
        return  # Table doesn't exist
    
    # Get current id column type
    id_column = None
    for col in inspector.get_columns('users'):
        if col['name'] == 'id':
            id_column = col
            break
    
    if not id_column:
        return  # No id column found
    
    id_type_str = str(id_column['type']).lower()
    
    # Check if id is not INTEGER - need to convert
    is_integer = 'integer' in id_type_str or 'int' in id_type_str or 'serial' in id_type_str
    
    if not is_integer:
        # Column is not INTEGER - need to convert
        # First, check if there are any existing rows
        result = conn.execute(text("SELECT COUNT(*) FROM users"))
        row_count = result.scalar() or 0
        
        if row_count == 0:
            # No rows, safe to drop and recreate
            conn.execute(text("ALTER TABLE users DROP CONSTRAINT IF EXISTS users_pkey"))
            conn.execute(text("ALTER TABLE users ALTER COLUMN id TYPE INTEGER USING NULL"))
            # We'll set up the sequence and default below
        else:
            # Has rows - need to preserve data
            # Try to convert existing ids to integers
            # First, check if all existing ids are numeric
            result = conn.execute(text("""
                SELECT COUNT(*) FROM users 
                WHERE id::text !~ '^[0-9]+$' OR id IS NULL
            """))
            non_numeric_count = result.scalar() or 0
            
            if non_numeric_count == 0:
                # All ids are numeric, safe to convert
                # Drop primary key constraint temporarily
                conn.execute(text("ALTER TABLE users DROP CONSTRAINT IF EXISTS users_pkey"))
                # Convert column type
                try:
                    conn.execute(text("ALTER TABLE users ALTER COLUMN id TYPE INTEGER USING CAST(id AS INTEGER)"))
                except Exception as e:
                    # If conversion fails, try alternative approach
                    # Create a temporary INTEGER column
                    conn.execute(text("ALTER TABLE users ADD COLUMN id_new INTEGER"))
                    # Try to populate it
                    conn.execute(text("""
                        UPDATE users 
                        SET id_new = CAST(id AS INTEGER)
                        WHERE id::text ~ '^[0-9]+$'
                    """))
                    # Generate sequential ids for non-numeric ones
                    conn.execute(text("""
                        UPDATE users 
                        SET id_new = COALESCE(
                            (SELECT MAX(id_new) FROM users WHERE id_new IS NOT NULL),
                            0
                        ) + row_number() OVER (ORDER BY id)
                        WHERE id_new IS NULL
                    """))
                    # Drop old column and rename new one
                    conn.execute(text("ALTER TABLE users DROP COLUMN id"))
                    conn.execute(text("ALTER TABLE users RENAME COLUMN id_new TO id"))
                    conn.execute(text("ALTER TABLE users ALTER COLUMN id SET NOT NULL"))
                    conn.execute(text("ALTER TABLE users ADD PRIMARY KEY (id)"))
            else:
                # Some ids are non-numeric - assign new sequential ids
                conn.execute(text("ALTER TABLE users DROP CONSTRAINT IF EXISTS users_pkey"))
                # Create new integer id column
                conn.execute(text("ALTER TABLE users ADD COLUMN id_new SERIAL"))
                # Drop old id and rename new one
                conn.execute(text("ALTER TABLE users DROP COLUMN id"))
                conn.execute(text("ALTER TABLE users RENAME COLUMN id_new TO id"))
                conn.execute(text("ALTER TABLE users ALTER COLUMN id SET NOT NULL"))
                conn.execute(text("ALTER TABLE users ADD PRIMARY KEY (id)"))
    
    # Now ensure sequence exists and is properly set up
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
        max_id = result.scalar() or 0
        start_val = max_id + 1 if max_id > 0 else 1
        conn.execute(text(f"SELECT setval('users_id_seq', {start_val}, false)"))
    
    # Ensure default is set
    result = conn.execute(text("""
        SELECT column_default 
        FROM information_schema.columns 
        WHERE table_name = 'users' AND column_name = 'id'
    """))
    row = result.fetchone()
    default = row[0] if row else None
    
    if not default or 'nextval' not in str(default).lower():
        # Set default
        conn.execute(text("ALTER TABLE users ALTER COLUMN id SET DEFAULT nextval('users_id_seq'::regclass)"))
    
    # Ensure primary key constraint exists
    try:
        result = conn.execute(text("""
            SELECT COUNT(*) FROM pg_constraint 
            WHERE conname = 'users_pkey' AND conrelid = 'users'::regclass
        """))
        pk_exists = result.scalar() or 0
        if pk_exists == 0:
            conn.execute(text("ALTER TABLE users ADD PRIMARY KEY (id)"))
    except Exception:
        pass  # PK might already exist


def downgrade() -> None:
    # Don't change id column back (too dangerous)
    pass

