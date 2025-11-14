"""Fix users table - add missing password_salt and is_admin columns

Revision ID: 0007_fix_users_columns
Revises: 0006_add_users_table
Create Date: 2024-11-14 15:30:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect, text


# revision identifiers, used by Alembic.
revision = '0007_fix_users_columns'
down_revision = '0006_add_users_table'
branch_labels = None
depends_on = None


def upgrade() -> None:
    conn = op.get_bind()
    inspector = inspect(conn)
    
    if 'users' not in inspector.get_table_names():
        return  # Table doesn't exist, nothing to fix
    
    columns = [col['name'] for col in inspector.get_columns('users')]
    
    # Check and add missing columns
    with op.batch_alter_table('users', schema=None) as batch_op:
        if 'password_salt' not in columns:
            # Add password_salt as nullable first
            batch_op.add_column(sa.Column('password_salt', sa.String(length=64), nullable=True))
        
        if 'is_admin' not in columns:
            # Add is_admin with default
            batch_op.add_column(sa.Column('is_admin', sa.Integer(), server_default=sa.text('0'), nullable=False))
    
    # Handle password_salt for existing rows
    if 'password_salt' not in columns:
        # Check if there are existing users
        result = conn.execute(text("SELECT COUNT(*) FROM users"))
        user_count = result.scalar()
        
        if user_count > 0:
            # Generate random salts for existing users
            conn.execute(text("""
                UPDATE users 
                SET password_salt = substr(md5(random()::text || clock_timestamp()::text), 1, 64)
                WHERE password_salt IS NULL
            """))
        
        # Now make it NOT NULL
        conn.execute(text("ALTER TABLE users ALTER COLUMN password_salt SET NOT NULL"))


def downgrade() -> None:
    # Don't remove columns (too dangerous)
    pass

