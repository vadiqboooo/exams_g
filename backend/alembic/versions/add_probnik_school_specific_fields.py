"""add probnik school specific fields

Revision ID: add_probnik_school_specific
Revises: add_probnik_table
Create Date: 2024-12-20

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'add_probnik_school_specific'
down_revision = 'add_probnik_table'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Добавляем новые поля для отдельных дней и времени для каждого филиала
    op.add_column('probnik', sa.Column('exam_dates_baikalskaya', sa.JSON(), nullable=True))
    op.add_column('probnik', sa.Column('exam_dates_lermontova', sa.JSON(), nullable=True))
    op.add_column('probnik', sa.Column('exam_times_baikalskaya', sa.JSON(), nullable=True))
    op.add_column('probnik', sa.Column('exam_times_lermontova', sa.JSON(), nullable=True))


def downgrade() -> None:
    op.drop_column('probnik', 'exam_times_lermontova')
    op.drop_column('probnik', 'exam_times_baikalskaya')
    op.drop_column('probnik', 'exam_dates_lermontova')
    op.drop_column('probnik', 'exam_dates_baikalskaya')


