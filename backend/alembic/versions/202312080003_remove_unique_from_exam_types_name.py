"""remove unique constraint from exam_types.name and add composite unique index

Revision ID: remove_unique_from_exam_types_name
Revises: link_exam_types_to_groups
Create Date: 2025-12-08 00:03:00
"""
from alembic import op
import sqlalchemy as sa


revision = 'remove_unique_from_exam_types_name'
down_revision = 'link_exam_types_to_groups'
branch_labels = None
depends_on = None


def upgrade():
    connection = op.get_bind()
    inspector = sa.inspect(connection)

    existing_tables = inspector.get_table_names()
    
    if 'exam_types' not in existing_tables:
        return  # Таблица не существует, пропускаем

    # Получаем информацию об индексах
    indexes = inspector.get_indexes('exam_types')
    
    # Проверяем, есть ли уникальный индекс на name
    has_unique_name = False
    for idx in indexes:
        if len(idx['column_names']) == 1 and idx['column_names'][0] == 'name' and idx.get('unique', False):
            has_unique_name = True
            # Удаляем уникальный индекс на name
            try:
                op.drop_index(idx['name'], table_name='exam_types')
            except Exception:
                pass
            break
    
    # Создаем составной уникальный индекс на (name, group_id)
    # Это позволит иметь одинаковые названия для разных групп
    try:
        op.create_index(
            'uq_exam_types_name_group',
            'exam_types',
            ['name', 'group_id'],
            unique=True
        )
    except Exception:
        pass  # Индекс может уже существовать


def downgrade():
    # Удаляем составной индекс
    try:
        op.drop_index('uq_exam_types_name_group', table_name='exam_types')
    except Exception:
        pass
    
    # Восстанавливаем уникальный индекс на name
    try:
        op.create_index(
            'ix_exam_types_name',
            'exam_types',
            ['name'],
            unique=True
        )
    except Exception:
        pass

