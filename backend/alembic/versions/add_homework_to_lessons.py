"""add homework to lessons

Revision ID: add_homework_to_lessons
Revises: add_lessons_tables
Create Date: 2026-02-09

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'add_homework_to_lessons'
down_revision = 'add_lessons_tables'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Добавляем поле homework в таблицу lessons
    with op.batch_alter_table('lessons', schema=None) as batch_op:
        batch_op.add_column(sa.Column('homework', sa.Text(), nullable=True))


def downgrade() -> None:
    with op.batch_alter_table('lessons', schema=None) as batch_op:
        batch_op.drop_column('homework')
