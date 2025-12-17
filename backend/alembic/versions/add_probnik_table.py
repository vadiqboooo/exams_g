"""add probnik table

Revision ID: add_probnik_table
Revises: c67e62400a96
Create Date: 2024-12-17

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'add_probnik_table'
down_revision = 'add_attended_submitted'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Создаем таблицу probnik
    op.create_table('probnik',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(length=200), nullable=False),
        sa.Column('is_active', sa.Boolean(), nullable=True, default=False),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('slots_baikalskaya', sa.JSON(), nullable=True),
        sa.Column('slots_lermontova', sa.JSON(), nullable=True),
        sa.Column('exam_dates', sa.JSON(), nullable=True),
        sa.Column('exam_times', sa.JSON(), nullable=True),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_probnik_id'), 'probnik', ['id'], unique=False)
    
    # Добавляем колонку probnik_id в exam_registration
    op.add_column('exam_registration', sa.Column('probnik_id', sa.Integer(), nullable=True))
    op.create_foreign_key('fk_exam_registration_probnik', 'exam_registration', 'probnik', ['probnik_id'], ['id'])


def downgrade() -> None:
    op.drop_constraint('fk_exam_registration_probnik', 'exam_registration', type_='foreignkey')
    op.drop_column('exam_registration', 'probnik_id')
    op.drop_index(op.f('ix_probnik_id'), table_name='probnik')
    op.drop_table('probnik')

