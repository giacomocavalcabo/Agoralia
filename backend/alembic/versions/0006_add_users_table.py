"""Add users table if missing or add tenant_id column

Revision ID: 0006_add_users_table
Revises: 0005_optimize_calls_schema
Create Date: 2024-11-14 15:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect


# revision identifiers, used by Alembic.
revision = '0006_add_users_table'
down_revision = '0005_optimize_calls_schema'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Check if users table exists
    conn = op.get_bind()
    inspector = inspect(conn)
    tables = inspector.get_table_names()
    
    if 'users' not in tables:
        # Create users table from scratch
        op.create_table(
            'users',
            sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
            sa.Column('tenant_id', sa.Integer(), nullable=False),
            sa.Column('email', sa.String(length=256), nullable=False),
            sa.Column('name', sa.String(length=128), nullable=True),
            sa.Column('password_salt', sa.String(length=64), nullable=False),
            sa.Column('password_hash', sa.String(length=128), nullable=False),
            sa.Column('is_admin', sa.Integer(), server_default=sa.text('0'), nullable=False),
            sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        )
    else:
        # Table exists, check what columns are missing
        columns = [col['name'] for col in inspector.get_columns('users')]
        columns_info = {col['name']: col for col in inspector.get_columns('users')}
        
        # Check and add missing columns
        columns_to_add = []
        if 'tenant_id' not in columns:
            columns_to_add.append(('tenant_id', sa.Integer()))
        if 'password_salt' not in columns:
            columns_to_add.append(('password_salt', sa.String(length=64)))
        if 'is_admin' not in columns:
            columns_to_add.append(('is_admin', sa.Integer(), {'server_default': sa.text('0')}))
        
        # Add missing columns
        if columns_to_add:
            with op.batch_alter_table('users', schema=None) as batch_op:
                for col_info in columns_to_add:
                    col_name = col_info[0]
                    col_type = col_info[1]
                    kwargs = col_info[2] if len(col_info) > 2 else {}
                    if col_name == 'tenant_id':
                        batch_op.add_column(sa.Column(col_name, col_type, nullable=True, **kwargs))
                    else:
                        # password_salt and is_admin need defaults or can be nullable initially
                        if col_name == 'password_salt':
                            # Can't be nullable in model, but we need to set defaults for existing rows
                            batch_op.add_column(sa.Column(col_name, col_type, nullable=True))
                        else:
                            batch_op.add_column(sa.Column(col_name, col_type, nullable=False, **kwargs))
        
        # Get user count and id column type for handling existing rows
        from sqlalchemy import text
        result = conn.execute(text("SELECT COUNT(*) FROM users"))
        user_count = result.scalar()
        
        # Check if id column is integer or varchar
        id_column_type = None
        for col in inspector.get_columns('users'):
            if col['name'] == 'id':
                id_column_type = str(col['type'])
                break
        
        # Now handle tenant_id specifically
        if 'tenant_id' not in columns:
            # Update existing rows: set tenant_id = id
            if user_count > 0:
                # There are existing users, need to set tenant_id
                # Check if id is integer or needs casting
                if 'varchar' in id_column_type.lower() or 'text' in id_column_type.lower() or 'char' in id_column_type.lower():
                    # id is string, can't use it directly as tenant_id
                    # Create a sequence or use row_number
                    # For now, set tenant_id to a hash or sequential number
                    conn.execute(text("""
                        UPDATE users 
                        SET tenant_id = COALESCE(
                            CAST(SUBSTRING(id FROM '^([0-9]+)') AS INTEGER),
                            row_number() OVER ()
                        )
                        WHERE tenant_id IS NULL
                    """))
                else:
                    # id is integer, can use directly
                    conn.execute(text("UPDATE users SET tenant_id = CAST(id AS INTEGER) WHERE tenant_id IS NULL"))
            
            # Now make it NOT NULL - PostgreSQL needs special handling
            # First check if there are any NULL values
            result = conn.execute(text("SELECT COUNT(*) FROM users WHERE tenant_id IS NULL"))
            null_count = result.scalar()
            
            if null_count == 0:
                # All rows have tenant_id, can make it NOT NULL
                # For PostgreSQL, we need to use ALTER COLUMN ... SET NOT NULL
                conn.execute(text("ALTER TABLE users ALTER COLUMN tenant_id SET NOT NULL"))
            else:
                # Still some NULLs, set defaults for them (use row_number if needed)
                conn.execute(text("""
                    UPDATE users 
                    SET tenant_id = COALESCE(
                        CAST(SUBSTRING(id::text FROM '^([0-9]+)') AS INTEGER),
                        row_number() OVER ()
                    )
                    WHERE tenant_id IS NULL
                """))
                conn.execute(text("ALTER TABLE users ALTER COLUMN tenant_id SET NOT NULL"))
        
        # Handle password_salt for existing rows
        if 'password_salt' not in columns and user_count > 0:
            # Generate random salts for existing users
            conn.execute(text("""
                UPDATE users 
                SET password_salt = substr(md5(random()::text || clock_timestamp()::text), 1, 64)
                WHERE password_salt IS NULL
            """))
            # Now make it NOT NULL
            conn.execute(text("ALTER TABLE users ALTER COLUMN password_salt SET NOT NULL"))


def downgrade() -> None:
    # Don't drop users table (too dangerous)
    # Just remove tenant_id if it was added
    conn = op.get_bind()
    inspector = inspect(conn)
    
    if 'users' in inspector.get_table_names():
        columns = [col['name'] for col in inspector.get_columns('users')]
        if 'tenant_id' in columns:
            with op.batch_alter_table('users', schema=None) as batch_op:
                batch_op.drop_column('tenant_id')

