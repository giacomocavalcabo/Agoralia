"""Complete auth system for Sprint 11

Revision ID: 0009_auth_complete_sprint11
Revises: 0003_numbers_outcomes
Create Date: 2025-01-19 10:00:00

"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '0009_auth_complete_sprint11'
down_revision = '0003_numbers_outcomes'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add missing fields to users table
    with op.batch_alter_table('users') as batch_op:
        batch_op.add_column(sa.Column('email_verified_at', sa.DateTime()))
        batch_op.add_column(sa.Column('totp_enabled', sa.Boolean(), server_default=sa.text('false')))
        batch_op.add_column(sa.Column('totp_verified_at', sa.DateTime()))
    
    # Add missing fields to user_auth table
    with op.batch_alter_table('user_auth') as batch_op:
        batch_op.add_column(sa.Column('totp_verified_at', sa.DateTime()))
        batch_op.add_column(sa.Column('recovery_codes_json', sa.JSON()))
        batch_op.add_column(sa.Column('last_used_at', sa.DateTime()))
    
    # Create sessions table for Redis fallback and audit
    op.create_table(
        'sessions',
        sa.Column('id', sa.String(), primary_key=True),
        sa.Column('user_id', sa.String(), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('last_seen_at', sa.DateTime(), nullable=False),
        sa.Column('ip', sa.String()),
        sa.Column('user_agent', sa.String()),
        sa.Column('revoked_at', sa.DateTime()),
        sa.Column('metadata_json', sa.JSON()),
    )
    
    # Create magic_links table (if not exists)
    op.create_table(
        'magic_links',
        sa.Column('id', sa.String(), primary_key=True),
        sa.Column('user_id', sa.String(), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('token_hash', sa.String(), nullable=False),
        sa.Column('expires_at', sa.DateTime(), nullable=False),
        sa.Column('used_at', sa.DateTime()),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('CURRENT_TIMESTAMP')),
    )
    
    # Create indexes
    op.create_index('ix_sessions_user_id', 'sessions', ['user_id'])
    op.create_index('ix_sessions_revoked_at', 'sessions', ['revoked_at'])
    op.create_index('ix_magic_links_token_hash', 'magic_links', ['token_hash'])
    op.create_index('ix_magic_links_expires_at', 'magic_links', ['expires_at'])
    op.create_index('ix_users_email_verified_at', 'users', ['email_verified_at'])


def downgrade() -> None:
    # Drop indexes
    op.drop_index('ix_users_email_verified_at', 'users')
    op.drop_index('ix_magic_links_expires_at', 'magic_links')
    op.drop_index('ix_magic_links_token_hash', 'magic_links')
    op.drop_index('ix_sessions_revoked_at', 'sessions')
    op.drop_index('ix_sessions_user_id', 'sessions')
    
    # Drop tables
    op.drop_table('magic_links')
    op.drop_table('sessions')
    
    # Remove columns from user_auth
    with op.batch_alter_table('user_auth') as batch_op:
        batch_op.drop_column('last_used_at')
        batch_op.drop_column('recovery_codes_json')
        batch_op.drop_column('totp_verified_at')
    
    # Remove columns from users
    with op.batch_alter_table('users') as batch_op:
        batch_op.drop_column('totp_verified_at')
        batch_op.drop_column('totp_enabled')
        batch_op.drop_column('email_verified_at')
