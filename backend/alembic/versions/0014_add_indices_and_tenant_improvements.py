"""Add indices, constraints, and tenant improvements

Revision ID: 0014_add_indices_and_tenant_improvements
Revises: 0013_add_retell_agent_id
Create Date: 2024-11-15 14:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect, text


# revision identifiers, used by Alembic.
revision = '0014_add_indices_and_tenant_improvements'
down_revision = '0013_add_retell_agent_id'
branch_labels = None
depends_on = None


def upgrade() -> None:
    conn = op.get_bind()
    inspector = inspect(conn)
    
    # ============================================================================
    # 1. Unique indices on mapping fields (ensure one-to-one Retell ↔ Agoralia)
    # ============================================================================
    
    # CallRecord.provider_call_id should be unique (one Retell call_id = one Agoralia call)
    if 'calls' in inspector.get_table_names():
        columns = [col['name'] for col in inspector.get_columns('calls')]
        
        # Check if index already exists
        indexes = [idx['name'] for idx in inspector.get_indexes('calls')]
        
        if 'idx_calls_provider_call_id' not in indexes:
            try:
                # Create unique index on provider_call_id (allows NULLs)
                op.execute(text("""
                    CREATE UNIQUE INDEX idx_calls_provider_call_id 
                    ON calls(provider_call_id) 
                    WHERE provider_call_id IS NOT NULL
                """))
            except Exception as e:
                # If fails (e.g., duplicate data), log and continue
                print(f"[WARN] Could not create unique index on calls.provider_call_id: {e}")
    
    # Agent.retell_agent_id should be unique (one Retell agent_id = one Agoralia agent)
    if 'agents' in inspector.get_table_names():
        columns = [col['name'] for col in inspector.get_columns('agents')]
        
        if 'retell_agent_id' in columns:
            indexes = [idx['name'] for idx in inspector.get_indexes('agents')]
            
            if 'idx_agents_retell_agent_id' not in indexes:
                try:
                    op.execute(text("""
                        CREATE UNIQUE INDEX idx_agents_retell_agent_id 
                        ON agents(retell_agent_id) 
                        WHERE retell_agent_id IS NOT NULL
                    """))
                except Exception as e:
                    print(f"[WARN] Could not create unique index on agents.retell_agent_id: {e}")
    
    # PhoneNumber.e164 should be unique (one Retell phone_number = one Agoralia phone_number)
    if 'numbers' in inspector.get_table_names():
        indexes = [idx['name'] for idx in inspector.get_indexes('numbers')]
        
        if 'idx_numbers_e164' not in indexes:
            try:
                op.execute(text("""
                    CREATE UNIQUE INDEX idx_numbers_e164 
                    ON numbers(e164) 
                    WHERE e164 IS NOT NULL
                """))
            except Exception as e:
                print(f"[WARN] Could not create unique index on numbers.e164: {e}")
    
    # ============================================================================
    # 2. Add duration_seconds and call_cost to CallRecord for billing
    # ============================================================================
    
    if 'calls' in inspector.get_table_names():
        columns = [col['name'] for col in inspector.get_columns('calls')]
        
        with op.batch_alter_table('calls', schema=None) as batch_op:
            if 'duration_seconds' not in columns:
                batch_op.add_column(sa.Column('duration_seconds', sa.Integer(), nullable=True))
            if 'call_cost_cents' not in columns:
                batch_op.add_column(sa.Column('call_cost_cents', sa.Integer(), nullable=True))
                # Note: Using cents to avoid floating point issues in billing
    
    # ============================================================================
    # 3. Add last_event_type and last_event_at to CallRecord for idempotency
    # ============================================================================
    
    if 'calls' in inspector.get_table_names():
        columns = [col['name'] for col in inspector.get_columns('calls')]
        
        with op.batch_alter_table('calls', schema=None) as batch_op:
            if 'last_event_type' not in columns:
                batch_op.add_column(sa.Column('last_event_type', sa.String(length=64), nullable=True))
            if 'last_event_at' not in columns:
                batch_op.add_column(sa.Column('last_event_at', sa.DateTime(timezone=True), nullable=True))
    
    # ============================================================================
    # 4. Support for BYO Retell account (if tenants table exists)
    # ============================================================================
    
    # Check if tenants table exists (might not exist if multi-tenant is implicit)
    if 'tenants' in inspector.get_table_names():
        columns = [col['name'] for col in inspector.get_columns('tenants')]
        
        with op.batch_alter_table('tenants', schema=None) as batch_op:
            if 'retell_api_key' not in columns:
                batch_op.add_column(sa.Column('retell_api_key', sa.Text(), nullable=True))
                # Nullable: if NULL, use global RETELL_API_KEY
            if 'retell_webhook_secret' not in columns:
                batch_op.add_column(sa.Column('retell_webhook_secret', sa.Text(), nullable=True))
    
    # ============================================================================
    # 5. Join tables for shared resources (optional, but schema ready)
    # ============================================================================
    
    # agent_tenants: many-to-many relationship for shared agents
    if 'agent_tenants' not in inspector.get_table_names():
        op.create_table(
            'agent_tenants',
            sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
            sa.Column('agent_id', sa.Integer(), sa.ForeignKey('agents.id', ondelete='CASCADE'), nullable=False),
            sa.Column('tenant_id', sa.Integer(), nullable=False),  # FK to tenants if exists
            sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
            sa.UniqueConstraint('agent_id', 'tenant_id', name='uq_agent_tenant'),
        )
        op.create_index('idx_agent_tenants_agent_id', 'agent_tenants', ['agent_id'])
        op.create_index('idx_agent_tenants_tenant_id', 'agent_tenants', ['tenant_id'])
    
    # phone_number_tenants: many-to-many relationship for shared phone numbers
    if 'phone_number_tenants' not in inspector.get_table_names():
        op.create_table(
            'phone_number_tenants',
            sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
            sa.Column('phone_number_id', sa.Integer(), sa.ForeignKey('numbers.id', ondelete='CASCADE'), nullable=False),
            sa.Column('tenant_id', sa.Integer(), nullable=False),  # FK to tenants if exists
            sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
            sa.UniqueConstraint('phone_number_id', 'tenant_id', name='uq_phone_number_tenant'),
        )
        op.create_index('idx_phone_number_tenants_phone_id', 'phone_number_tenants', ['phone_number_id'])
        op.create_index('idx_phone_number_tenants_tenant_id', 'phone_number_tenants', ['tenant_id'])
    
    # ============================================================================
    # 6. Index on tenant_id for better query performance
    # ============================================================================
    
    # Index on calls.tenant_id (most queried table)
    if 'calls' in inspector.get_table_names():
        indexes = [idx['name'] for idx in inspector.get_indexes('calls')]
        if 'idx_calls_tenant_id' not in indexes:
            op.create_index('idx_calls_tenant_id', 'calls', ['tenant_id'])
    
    # Index on agents.tenant_id
    if 'agents' in inspector.get_table_names():
        indexes = [idx['name'] for idx in inspector.get_indexes('agents')]
        if 'idx_agents_tenant_id' not in indexes:
            op.create_index('idx_agents_tenant_id', 'agents', ['tenant_id'])
    
    # Index on numbers.tenant_id
    if 'numbers' in inspector.get_table_names():
        indexes = [idx['name'] for idx in inspector.get_indexes('numbers')]
        if 'idx_numbers_tenant_id' not in indexes:
            op.create_index('idx_numbers_tenant_id', 'numbers', ['tenant_id'])
    
    # Index on numbers.e164 for webhook lookup
    if 'numbers' in inspector.get_table_names():
        indexes = [idx['name'] for idx in inspector.get_indexes('numbers')]
        if 'idx_numbers_e164_lookup' not in indexes:
            # Note: we already have unique index on e164 above, but adding a regular one too for clarity
            pass  # Already covered by unique index


def downgrade() -> None:
    # Drop indices
    op.execute(text("DROP INDEX IF EXISTS idx_calls_provider_call_id"))
    op.execute(text("DROP INDEX IF EXISTS idx_agents_retell_agent_id"))
    op.execute(text("DROP INDEX IF EXISTS idx_numbers_e164"))
    op.execute(text("DROP INDEX IF EXISTS idx_calls_tenant_id"))
    op.execute(text("DROP INDEX IF EXISTS idx_agents_tenant_id"))
    op.execute(text("DROP INDEX IF EXISTS idx_numbers_tenant_id"))
    
    # Drop join tables
    op.drop_table('phone_number_tenants')
    op.drop_table('agent_tenants')
    
    # Remove columns from calls (might fail if data exists, but that's ok)
    try:
        with op.batch_alter_table('calls', schema=None) as batch_op:
            batch_op.drop_column('last_event_at')
            batch_op.drop_column('last_event_type')
            batch_op.drop_column('call_cost_cents')
            batch_op.drop_column('duration_seconds')
    except Exception:
        pass
    
    # Remove columns from tenants (if exists)
    try:
        with op.batch_alter_table('tenants', schema=None) as batch_op:
            batch_op.drop_column('retell_webhook_secret')
            batch_op.drop_column('retell_api_key')
    except Exception:
        pass

