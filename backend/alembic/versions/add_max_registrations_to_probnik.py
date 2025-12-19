"""add max_registrations to probnik

Revision ID: add_max_registrations
Revises: add_probnik_school_specific
Create Date: 2024-12-20

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'add_max_registrations'
down_revision = 'add_probnik_school_specific'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Добавляем поле max_registrations в таблицу probnik
    op.add_column('probnik', sa.Column('max_registrations', sa.Integer(), nullable=True, server_default='4'))


def downgrade() -> None:
    op.drop_column('probnik', 'max_registrations')


