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
        # Table exists, check if tenant_id column exists
        columns = [col['name'] for col in inspector.get_columns('users')]
        
        if 'tenant_id' not in columns:
            # Add tenant_id column
            # First, set default value for existing rows (use id as tenant_id)
            with op.batch_alter_table('users', schema=None) as batch_op:
                batch_op.add_column(sa.Column('tenant_id', sa.Integer(), nullable=True))
            
            # Update existing rows: set tenant_id = id
            conn.execute(sa.text("UPDATE users SET tenant_id = id WHERE tenant_id IS NULL"))
            
            # Now make it NOT NULL
            with op.batch_alter_table('users', schema=None) as batch_op:
                batch_op.alter_column('tenant_id', nullable=False)


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

