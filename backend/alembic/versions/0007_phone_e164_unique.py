"""Add unique constraint on phone_e164 for leads
Revision ID: 0007
Revises: 0003_numbers_outcomes
Create Date: 2025-01-18 14:00:00.000000
"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '0007'
down_revision = '0003_numbers_outcomes'
branch_labels = None
depends_on = None

def upgrade() -> None:
    # Add unique constraint on (workspace_id, phone_e164) for leads table
    # This prevents duplicate phone numbers within the same workspace
    op.create_unique_constraint(
        'uq_leads_workspace_phone_e164', 
        'leads', 
        ['workspace_id', 'phone_e164']
    )
    
    # Add index for performance on phone lookups
    op.create_index(
        'ix_leads_phone_e164', 
        'leads', 
        ['phone_e164']
    )

def downgrade() -> None:
    # Remove the unique constraint and index
    op.drop_constraint('uq_leads_workspace_phone_e164', 'leads', type_='unique')
    op.drop_index('ix_leads_phone_e164', 'leads')
