"""add grade_scale to subjects

Revision ID: add_grade_scale
Revises: add_subjects_table
Create Date: 2026-02-03

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'add_grade_scale'
down_revision = 'add_subjects_table'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Добавляем поле grade_scale в таблицу subjects
    with op.batch_alter_table('subjects', schema=None) as batch_op:
        batch_op.add_column(sa.Column('grade_scale', sa.JSON(), nullable=True))


def downgrade() -> None:
    with op.batch_alter_table('subjects', schema=None) as batch_op:
        batch_op.drop_column('grade_scale')
