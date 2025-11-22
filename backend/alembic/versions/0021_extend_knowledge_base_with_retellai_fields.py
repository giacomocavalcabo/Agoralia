"""Extend knowledge base table with RetellAI fields

Revision ID: 0021_extend_knowledge_base_with_retellai_fields
Revises: 0020_add_phone_number_renewal_tracking
Create Date: 2025-01-22 14:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect, text


# revision identifiers, used by Alembic.
revision: str = '0021_extend_knowledge_base_with_retellai_fields'
down_revision: Union[str, None] = '0020_add_phone_number_renewal_tracking'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add name, status, knowledge_base_sources, enable_auto_refresh, last_refreshed_timestamp, created_at, updated_at to kbs table"""
    conn = op.get_bind()
    inspector = inspect(conn)
    
    # Check if kbs table exists
    table_names = inspector.get_table_names()
    if 'kbs' not in table_names:
        print("[MIGRATION 0021] kbs table does not exist, skipping")
        return
    
    # Get existing columns
    columns = [col['name'] for col in inspector.get_columns('kbs')]
    
    # Add name if not exists
    if 'name' not in columns:
        op.execute(text("""
            ALTER TABLE kbs 
            ADD COLUMN name VARCHAR(40)
        """))
        conn.commit()
        print("[MIGRATION 0021] Added name column")
    
    # Add status if not exists
    if 'status' not in columns:
        op.execute(text("""
            ALTER TABLE kbs 
            ADD COLUMN status VARCHAR(16)
        """))
        conn.commit()
        print("[MIGRATION 0021] Added status column")
    
    # Add knowledge_base_sources if not exists (JSON column)
    if 'knowledge_base_sources' not in columns:
        # Check if PostgreSQL (supports JSON) or SQLite (supports TEXT)
        from sqlalchemy import inspect as sqlalchemy_inspect
        dialect_name = conn.dialect.name
        if dialect_name == 'postgresql':
            op.execute(text("""
                ALTER TABLE kbs 
                ADD COLUMN knowledge_base_sources JSONB
            """))
        else:
            # SQLite - use TEXT for JSON
            op.execute(text("""
                ALTER TABLE kbs 
                ADD COLUMN knowledge_base_sources TEXT
            """))
        conn.commit()
        print("[MIGRATION 0021] Added knowledge_base_sources column")
    
    # Add enable_auto_refresh if not exists
    if 'enable_auto_refresh' not in columns:
        op.execute(text("""
            ALTER TABLE kbs 
            ADD COLUMN enable_auto_refresh BOOLEAN
        """))
        conn.commit()
        print("[MIGRATION 0021] Added enable_auto_refresh column")
    
    # Add last_refreshed_timestamp if not exists
    if 'last_refreshed_timestamp' not in columns:
        op.execute(text("""
            ALTER TABLE kbs 
            ADD COLUMN last_refreshed_timestamp INTEGER
        """))
        conn.commit()
        print("[MIGRATION 0021] Added last_refreshed_timestamp column")
    
    # Add created_at if not exists
    if 'created_at' not in columns:
        op.execute(text("""
            ALTER TABLE kbs 
            ADD COLUMN created_at TIMESTAMPTZ DEFAULT NOW()
        """))
        # Set default for existing rows
        op.execute(text("""
            UPDATE kbs 
            SET created_at = NOW() 
            WHERE created_at IS NULL
        """))
        conn.commit()
        print("[MIGRATION 0021] Added created_at column")
    
    # Add updated_at if not exists
    if 'updated_at' not in columns:
        op.execute(text("""
            ALTER TABLE kbs 
            ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW()
        """))
        # Set default for existing rows
        op.execute(text("""
            UPDATE kbs 
            SET updated_at = NOW() 
            WHERE updated_at IS NULL
        """))
        conn.commit()
        print("[MIGRATION 0021] Added updated_at column")
    
    print("[MIGRATION 0021] Migration completed successfully")


def downgrade() -> None:
    """Remove RetellAI fields from kbs table"""
    conn = op.get_bind()
    inspector = inspect(conn)
    
    if 'kbs' not in inspector.get_table_names():
        return
    
    columns = [col['name'] for col in inspector.get_columns('kbs')]
    
    # Remove columns if they exist
    if 'name' in columns:
        op.execute(text("ALTER TABLE kbs DROP COLUMN name"))
        conn.commit()
    
    if 'status' in columns:
        op.execute(text("ALTER TABLE kbs DROP COLUMN status"))
        conn.commit()
    
    if 'knowledge_base_sources' in columns:
        op.execute(text("ALTER TABLE kbs DROP COLUMN knowledge_base_sources"))
        conn.commit()
    
    if 'enable_auto_refresh' in columns:
        op.execute(text("ALTER TABLE kbs DROP COLUMN enable_auto_refresh"))
        conn.commit()
    
    if 'last_refreshed_timestamp' in columns:
        op.execute(text("ALTER TABLE kbs DROP COLUMN last_refreshed_timestamp"))
        conn.commit()
    
    if 'created_at' in columns:
        op.execute(text("ALTER TABLE kbs DROP COLUMN created_at"))
        conn.commit()
    
    if 'updated_at' in columns:
        op.execute(text("ALTER TABLE kbs DROP COLUMN updated_at"))
        conn.commit()

