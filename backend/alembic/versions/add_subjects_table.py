"""add subjects table

Revision ID: add_subjects_table
Revises: add_created_by_exam
Create Date: 2026-02-03

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'add_subjects_table'
down_revision = 'add_created_by_exam'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Создаем таблицу subjects
    op.create_table(
        'subjects',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('code', sa.String(50), nullable=False),
        sa.Column('name', sa.String(200), nullable=False),
        sa.Column('exam_type', sa.String(20), nullable=False),
        sa.Column('tasks_count', sa.Integer(), nullable=False),
        sa.Column('max_per_task', sa.JSON(), nullable=False),
        sa.Column('primary_to_secondary_scale', sa.JSON(), nullable=True),
        sa.Column('special_config', sa.JSON(), nullable=True),
        sa.Column('topics', sa.JSON(), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=True, default=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint('id')
    )

    # Создаем индексы
    op.create_index('ix_subjects_id', 'subjects', ['id'])
    op.create_index('ix_subjects_code', 'subjects', ['code'], unique=True)


def downgrade() -> None:
    op.drop_index('ix_subjects_code', table_name='subjects')
    op.drop_index('ix_subjects_id', table_name='subjects')
    op.drop_table('subjects')
