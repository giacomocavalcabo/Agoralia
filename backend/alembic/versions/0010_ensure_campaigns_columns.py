"""Ensure campaigns table has all required columns

Revision ID: 0010_ensure_campaigns_columns
Revises: 0009_force_users_id_integer
Create Date: 2024-11-14 15:45:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect, text


# revision identifiers, used by Alembic.
revision = '0010_ensure_campaigns_columns'
down_revision = '0009_force_users_id_integer'
branch_labels = None
depends_on = None


def upgrade() -> None:
    conn = op.get_bind()
    inspector = inspect(conn)
    
    # Check if campaigns table exists
    if 'campaigns' not in inspector.get_table_names():
        # Create campaigns table from scratch with all columns
        op.create_table(
            'campaigns',
            sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
            sa.Column('tenant_id', sa.Integer(), nullable=True),
            sa.Column('name', sa.String(length=128), nullable=False),
            sa.Column('status', sa.String(length=16), nullable=True),
            
            # Agent and phone configuration
            sa.Column('agent_id', sa.String(length=128), nullable=True),
            sa.Column('from_number_id', sa.Integer(), sa.ForeignKey('numbers.id'), nullable=True),
            sa.Column('kb_id', sa.Integer(), sa.ForeignKey('kbs.id'), nullable=True),
            
            # Scheduling
            sa.Column('start_date', sa.DateTime(timezone=True), nullable=True),
            sa.Column('end_date', sa.DateTime(timezone=True), nullable=True),
            sa.Column('timezone', sa.String(length=64), nullable=True, server_default='UTC'),
            
            # Limits & Budget
            sa.Column('max_calls_per_day', sa.Integer(), nullable=True),
            sa.Column('budget_cents', sa.Integer(), nullable=True),
            sa.Column('cost_per_call_cents', sa.Integer(), nullable=True, server_default=sa.text('100')),
            
            # Stats
            sa.Column('calls_made', sa.Integer(), nullable=False, server_default=sa.text('0')),
            sa.Column('calls_successful', sa.Integer(), nullable=False, server_default=sa.text('0')),
            sa.Column('calls_failed', sa.Integer(), nullable=False, server_default=sa.text('0')),
            sa.Column('total_cost_cents', sa.Integer(), nullable=False, server_default=sa.text('0')),
            
            # Metadata
            sa.Column('metadata_json', sa.Text(), nullable=True),
            
            # Timestamps
            sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
            sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        )
    else:
        # Table exists, check and add missing columns
        columns = [col['name'] for col in inspector.get_columns('campaigns')]
        
        # Define all required columns with their types and defaults
        required_columns = {
            'agent_id': (sa.String(length=128), None, True),
            'from_number_id': (sa.Integer(), None, True),
            'kb_id': (sa.Integer(), None, True),
            'start_date': (sa.DateTime(timezone=True), None, True),
            'end_date': (sa.DateTime(timezone=True), None, True),
            'timezone': (sa.String(length=64), 'UTC', True),
            'max_calls_per_day': (sa.Integer(), None, True),
            'budget_cents': (sa.Integer(), None, True),
            'cost_per_call_cents': (sa.Integer(), '100', True),
            'calls_made': (sa.Integer(), '0', False),
            'calls_successful': (sa.Integer(), '0', False),
            'calls_failed': (sa.Integer(), '0', False),
            'total_cost_cents': (sa.Integer(), '0', False),
            'metadata_json': (sa.Text(), None, True),
            'updated_at': (sa.DateTime(timezone=True), 'now()', False),
        }
        
        # Add foreign key constraints separately
        fk_columns = {
            'from_number_id': 'numbers.id',
            'kb_id': 'kbs.id',
        }
        
        # Add missing columns
        with op.batch_alter_table('campaigns', schema=None) as batch_op:
            for col_name, (col_type, default_val, nullable) in required_columns.items():
                if col_name not in columns:
                    kwargs = {'nullable': nullable}
                    if default_val:
                        if default_val in ['0', '100', 'UTC']:
                            # Integer or string defaults
                            kwargs['server_default'] = sa.text(f"'{default_val}'" if default_val == 'UTC' else default_val)
                        elif default_val == 'now()':
                            kwargs['server_default'] = sa.text('now()')
                    
                    batch_op.add_column(sa.Column(col_name, col_type, **kwargs))
                    
                    # For NOT NULL columns with defaults, set defaults for existing rows
                    if not nullable and default_val:
                        if default_val in ['0', '100']:
                            conn.execute(text(f"UPDATE campaigns SET {col_name} = {default_val} WHERE {col_name} IS NULL"))
                        elif default_val == 'UTC' and col_name == 'timezone':
                            conn.execute(text(f"UPDATE campaigns SET {col_name} = 'UTC' WHERE {col_name} IS NULL"))
                        elif default_val == 'now()' and col_name == 'updated_at':
                            conn.execute(text(f"UPDATE campaigns SET {col_name} = now() WHERE {col_name} IS NULL"))
                    
                    # Make NOT NULL if required
                    if not nullable:
                        try:
                            conn.execute(text(f"ALTER TABLE campaigns ALTER COLUMN {col_name} SET NOT NULL"))
                        except Exception:
                            pass  # Already NOT NULL or has NULL values
        
        # Add foreign key constraints if columns exist and constraints don't exist
        for col_name, fk_ref in fk_columns.items():
            if col_name in columns:
                try:
                    # Check if foreign key already exists
                    result = conn.execute(text(f"""
                        SELECT COUNT(*) FROM information_schema.table_constraints 
                        WHERE constraint_name LIKE '%{col_name}%' 
                        AND table_name = 'campaigns'
                        AND constraint_type = 'FOREIGN KEY'
                    """))
                    fk_exists = result.scalar() > 0
                    
                    if not fk_exists:
                        fk_table = fk_ref.split('.')[0]
                        fk_column = fk_ref.split('.')[1]
                        conn.execute(text(f"""
                            ALTER TABLE campaigns 
                            ADD CONSTRAINT fk_campaigns_{col_name} 
                            FOREIGN KEY ({col_name}) REFERENCES {fk_table}({fk_column})
                        """))
                except Exception:
                    pass  # Constraint might already exist or table doesn't exist yet


def downgrade() -> None:
    # Don't remove columns (too dangerous)
    pass

