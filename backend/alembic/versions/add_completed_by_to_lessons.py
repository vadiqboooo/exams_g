"""add completed_by to lessons

Revision ID: add_completed_by
Revises:
Create Date: 2026-02-09

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'add_completed_by'
down_revision = 'add_homework_to_lessons'
branch_labels = None
depends_on = None


def upgrade():
    # Используем batch mode для SQLite
    with op.batch_alter_table('lessons', schema=None) as batch_op:
        batch_op.add_column(sa.Column('completed_by_id', sa.Integer(), nullable=True))
        batch_op.create_foreign_key(
            'fk_lessons_completed_by_id_employees',
            'employees',
            ['completed_by_id'], ['id']
        )


def downgrade():
    # Используем batch mode для SQLite
    with op.batch_alter_table('lessons', schema=None) as batch_op:
        batch_op.drop_constraint('fk_lessons_completed_by_id_employees', type_='foreignkey')
        batch_op.drop_column('completed_by_id')
