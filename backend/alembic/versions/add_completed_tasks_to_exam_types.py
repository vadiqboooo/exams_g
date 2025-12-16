"""add completed_tasks to exam_types

Revision ID: add_completed_tasks_to_exam_types
Revises: remove_unique_from_exam_types_name
Create Date: 2025-01-27 00:00:00
"""
from alembic import op
import sqlalchemy as sa


revision = 'add_completed_tasks_to_exam_types'
down_revision = 'remove_unique_from_exam_types_name'
branch_labels = None
depends_on = None


def upgrade():
    connection = op.get_bind()
    inspector = sa.inspect(connection)

    existing_tables = inspector.get_table_names()
    
    if 'exam_types' not in existing_tables:
        return  # Таблица не существует, пропускаем

    # Проверяем, существует ли уже колонка
    columns = [col['name'] for col in inspector.get_columns('exam_types')]
    
    if 'completed_tasks' not in columns:
        # Добавляем колонку completed_tasks типа JSON
        op.add_column('exam_types', sa.Column('completed_tasks', sa.JSON, nullable=True))


def downgrade():
    # Удаляем колонку completed_tasks
    try:
        op.drop_column('exam_types', 'completed_tasks')
    except Exception:
        pass




