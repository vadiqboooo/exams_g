"""add access_token to student

Revision ID: add_access_token
Revises: add_max_registrations
Create Date: 2026-02-02

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'add_access_token'
down_revision = 'add_max_registrations'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Добавляем поле access_token в таблицу student
    op.add_column('student', sa.Column('access_token', sa.String(64), nullable=True))

    # Создаем уникальный индекс для access_token
    op.create_index('ix_student_access_token', 'student', ['access_token'], unique=True)


def downgrade() -> None:
    op.drop_index('ix_student_access_token', table_name='student')
    op.drop_column('student', 'access_token')
