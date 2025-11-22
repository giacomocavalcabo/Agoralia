"""Add phone number renewal tracking fields

Revision ID: 0020_add_phone_number_renewal_tracking
Revises: 0019_extend_agents_table_with_full_retellai_fields
Create Date: 2025-01-22 12:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect, text


# revision identifiers, used by Alembic.
revision: str = '0020_add_phone_number_renewal_tracking'
down_revision: Union[str, None] = '0019_extend_agents_table_with_full_retellai_fields'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add purchased_at, monthly_cost_cents, next_renewal_at, created_at, updated_at to numbers table"""
    conn = op.get_bind()
    inspector = inspect(conn)
    
    # Check if numbers table exists
    table_names = inspector.get_table_names()
    if 'numbers' not in table_names:
        print("[MIGRATION 0020] numbers table does not exist, skipping")
        return
    
    # Get existing columns
    columns = [col['name'] for col in inspector.get_columns('numbers')]
    
    # Add purchased_at if not exists
    if 'purchased_at' not in columns:
        op.execute(text("""
            ALTER TABLE numbers 
            ADD COLUMN purchased_at TIMESTAMPTZ
        """))
        conn.commit()
        print("[MIGRATION 0020] Added purchased_at column")
    
    # Add monthly_cost_cents if not exists
    if 'monthly_cost_cents' not in columns:
        op.execute(text("""
            ALTER TABLE numbers 
            ADD COLUMN monthly_cost_cents INTEGER
        """))
        conn.commit()
        print("[MIGRATION 0020] Added monthly_cost_cents column")
    
    # Add next_renewal_at if not exists
    if 'next_renewal_at' not in columns:
        op.execute(text("""
            ALTER TABLE numbers 
            ADD COLUMN next_renewal_at TIMESTAMPTZ
        """))
        conn.commit()
        print("[MIGRATION 0020] Added next_renewal_at column")
    
    # Add created_at if not exists
    if 'created_at' not in columns:
        op.execute(text("""
            ALTER TABLE numbers 
            ADD COLUMN created_at TIMESTAMPTZ DEFAULT NOW()
        """))
        # Set default for existing rows
        op.execute(text("""
            UPDATE numbers 
            SET created_at = NOW() 
            WHERE created_at IS NULL
        """))
        conn.commit()
        print("[MIGRATION 0020] Added created_at column")
    
    # Add updated_at if not exists
    if 'updated_at' not in columns:
        op.execute(text("""
            ALTER TABLE numbers 
            ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW()
        """))
        # Set default for existing rows
        op.execute(text("""
            UPDATE numbers 
            SET updated_at = NOW() 
            WHERE updated_at IS NULL
        """))
        conn.commit()
        print("[MIGRATION 0020] Added updated_at column")
    
    # For existing numbers without purchased_at, set it to created_at (or now if both missing)
    op.execute(text("""
        UPDATE numbers 
        SET purchased_at = COALESCE(created_at, NOW()),
            next_renewal_at = COALESCE(created_at, NOW()) + INTERVAL '30 days'
        WHERE purchased_at IS NULL
    """))
    conn.commit()
    
    # For existing numbers without monthly_cost_cents, set default ($2/month = 200 cents)
    op.execute(text("""
        UPDATE numbers 
        SET monthly_cost_cents = 200
        WHERE monthly_cost_cents IS NULL
    """))
    conn.commit()
    
    # Calculate next_renewal_at for existing numbers
    op.execute(text("""
        UPDATE numbers 
        SET next_renewal_at = purchased_at + INTERVAL '30 days'
        WHERE next_renewal_at IS NULL AND purchased_at IS NOT NULL
    """))
    conn.commit()
    
    print("[MIGRATION 0020] Migration completed successfully")


def downgrade() -> None:
    """Remove renewal tracking columns from numbers table"""
    conn = op.get_bind()
    inspector = inspect(conn)
    
    if 'numbers' not in inspector.get_table_names():
        return
    
    columns = [col['name'] for col in inspector.get_columns('numbers')]
    
    # Remove columns if they exist
    if 'purchased_at' in columns:
        op.execute(text("ALTER TABLE numbers DROP COLUMN purchased_at"))
        conn.commit()
    
    if 'monthly_cost_cents' in columns:
        op.execute(text("ALTER TABLE numbers DROP COLUMN monthly_cost_cents"))
        conn.commit()
    
    if 'next_renewal_at' in columns:
        op.execute(text("ALTER TABLE numbers DROP COLUMN next_renewal_at"))
        conn.commit()
    
    if 'created_at' in columns:
        op.execute(text("ALTER TABLE numbers DROP COLUMN created_at"))
        conn.commit()
    
    if 'updated_at' in columns:
        op.execute(text("ALTER TABLE numbers DROP COLUMN updated_at"))
        conn.commit()

