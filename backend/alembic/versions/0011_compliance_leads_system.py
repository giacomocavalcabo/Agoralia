"""Add compliance leads system

Revision ID: 0011
Revises: 0010_kb_constraints_indexes
Create Date: 2025-01-27 10:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '0011'
down_revision = '0010_kb_constraints_indexes'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create leads table with compliance fields
    op.create_table('leads',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('workspace_id', sa.String(), nullable=False),
        sa.Column('name', sa.String(), nullable=True),
        sa.Column('company', sa.String(), nullable=True),
        sa.Column('email', sa.String(), nullable=True),
        sa.Column('phone_e164', sa.String(), nullable=False),
        sa.Column('country_iso', sa.String(length=2), nullable=True),
        sa.Column('lang', sa.String(), nullable=True),
        sa.Column('role', sa.String(), nullable=True),
        sa.Column('contact_class', sa.Enum('b2b', 'b2c', 'unknown', name='contact_class_enum'), nullable=True),
        sa.Column('relationship_basis', sa.Enum('existing', 'none', 'unknown', name='relationship_basis_enum'), nullable=True),
        sa.Column('opt_in', sa.Boolean(), nullable=True),
        sa.Column('national_dnc', sa.Enum('in', 'not_in', 'unknown', name='national_dnc_enum'), nullable=True),
        sa.Column('compliance_category', sa.Enum('allowed', 'conditional', 'blocked', name='compliance_category_enum'), nullable=True),
        sa.Column('compliance_reasons', sa.JSON(), nullable=True),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['workspace_id'], ['workspaces.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    
    # Create import_jobs table
    op.create_table('import_jobs',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('workspace_id', sa.String(), nullable=False),
        sa.Column('user_id', sa.String(), nullable=False),
        sa.Column('filename', sa.String(), nullable=True),
        sa.Column('file_size_bytes', sa.Integer(), nullable=True),
        sa.Column('status', sa.String(), nullable=True),
        sa.Column('mapping_config', sa.JSON(), nullable=True),
        sa.Column('progress', sa.Integer(), nullable=True),
        sa.Column('total_rows', sa.Integer(), nullable=True),
        sa.Column('processed_rows', sa.Integer(), nullable=True),
        sa.Column('errors', sa.JSON(), nullable=True),
        sa.Column('warnings', sa.JSON(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
        sa.ForeignKeyConstraint(['workspace_id'], ['workspaces.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    
    # Create indexes for performance
    op.create_index('ix_leads_workspace_id', 'leads', ['workspace_id'])
    op.create_index('ix_leads_phone_e164', 'leads', ['phone_e164'])
    op.create_index('ix_leads_country_iso', 'leads', ['country_iso'])
    op.create_index('ix_leads_compliance_category', 'leads', ['compliance_category'])
    op.create_index('ix_leads_contact_class', 'leads', ['contact_class'])
    
    op.create_index('ix_import_jobs_workspace_id', 'import_jobs', ['workspace_id'])
    op.create_index('ix_import_jobs_status', 'import_jobs', ['status'])
    op.create_index('ix_import_jobs_created_at', 'import_jobs', ['created_at'])
    
    # Add unique constraint for (workspace_id, phone_e164)
    op.create_unique_constraint('uq_leads_workspace_phone_e164', 'leads', ['workspace_id', 'phone_e164'])


def downgrade() -> None:
    # Remove indexes
    op.drop_index('ix_leads_workspace_id', table_name='leads')
    op.drop_index('ix_leads_phone_e164', table_name='leads')
    op.drop_index('ix_leads_country_iso', table_name='leads')
    op.drop_index('ix_leads_compliance_category', table_name='leads')
    op.drop_index('ix_leads_contact_class', table_name='leads')
    
    op.drop_index('ix_import_jobs_workspace_id', table_name='import_jobs')
    op.drop_index('ix_import_jobs_status', table_name='import_jobs')
    op.drop_index('ix_import_jobs_created_at', table_name='import_jobs')
    
    # Remove unique constraint
    op.drop_constraint('uq_leads_workspace_phone_e164', 'leads', type_='unique')
    
    # Drop tables
    op.drop_table('import_jobs')
    op.drop_table('leads')
    
    # Drop enums
    op.execute("DROP TYPE contact_class_enum")
    op.execute("DROP TYPE relationship_basis_enum")
    op.execute("DROP TYPE national_dnc_enum")
    op.execute("DROP TYPE compliance_category_enum")
