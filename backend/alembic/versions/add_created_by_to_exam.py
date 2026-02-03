"""add created_by_id to exam

Revision ID: add_created_by_exam
Revises: add_access_token
Create Date: 2026-02-03

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'add_created_by_exam'
down_revision = 'add_access_token'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Для SQLite используем batch mode для добавления колонки с внешним ключом
    with op.batch_alter_table('exam', schema=None) as batch_op:
        batch_op.add_column(sa.Column('created_by_id', sa.Integer(), nullable=True))
        batch_op.create_foreign_key(
            'fk_exam_created_by_id_employees',
            'employees',
            ['created_by_id'],
            ['id']
        )


def downgrade() -> None:
    with op.batch_alter_table('exam', schema=None) as batch_op:
        batch_op.drop_constraint('fk_exam_created_by_id_employees', type_='foreignkey')
        batch_op.drop_column('created_by_id')
