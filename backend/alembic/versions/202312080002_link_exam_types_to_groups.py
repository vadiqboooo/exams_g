"""link exam_types to groups and remove name from exam

Revision ID: link_exam_types_to_groups
Revises: add_exam_types
Create Date: 2025-12-08 00:02:00
"""
from alembic import op
import sqlalchemy as sa


revision = 'link_exam_types_to_groups'
down_revision = 'add_exam_types'
branch_labels = None
depends_on = None


def upgrade():
    connection = op.get_bind()
    inspector = sa.inspect(connection)

    existing_tables = inspector.get_table_names()
    
    if 'exam_types' not in existing_tables:
        return  # Таблица не существует, пропускаем

    exam_types_columns = [col['name'] for col in inspector.get_columns('exam_types')]
    exam_columns = [col['name'] for col in inspector.get_columns('exam')]

    # 1. Добавляем group_id в exam_types
    if 'group_id' not in exam_types_columns:
        with op.batch_alter_table('exam_types', schema=None) as batch_op:
            batch_op.add_column(sa.Column('group_id', sa.Integer(), nullable=True))
        
        # Заполняем group_id на основе существующих данных
        # Для каждого exam_type находим группу через exam -> student -> groups
        # Но проще: создаем временную связь через exam
        connection.execute(sa.text("""
            UPDATE exam_types
            SET group_id = (
                SELECT DISTINCT gs.group_id
                FROM exam e
                JOIN group_student gs ON e.id_student = gs.student_id
                WHERE e.exam_type_id = exam_types.id
                LIMIT 1
            )
            WHERE group_id IS NULL
        """))
        connection.commit()
        
        # Если остались exam_types без group_id, используем первую группу как дефолт
        result = connection.execute(sa.text("SELECT id FROM study_group LIMIT 1"))
        first_group = result.fetchone()
        if first_group:
            default_group_id = first_group[0]
            connection.execute(sa.text("""
                UPDATE exam_types
                SET group_id = :group_id
                WHERE group_id IS NULL
            """), {"group_id": default_group_id})
            connection.commit()
        
        # Делаем group_id NOT NULL и создаем FK
        with op.batch_alter_table('exam_types', schema=None) as batch_op:
            batch_op.alter_column('group_id', existing_type=sa.Integer(), nullable=False)
            try:
                batch_op.create_foreign_key(
                    'fk_exam_types_group_id',
                    'study_group',
                    ['group_id'],
                    ['id']
                )
            except Exception:
                pass  # FK может уже существовать
    
    # 2. Удаляем уникальный индекс на name и создаем составной уникальный индекс на (name, group_id)
    # Проверяем существующие индексы
    indexes = inspector.get_indexes('exam_types')
    for idx in indexes:
        idx_name = idx['name']
        # Удаляем автоматический уникальный индекс на name, если он есть
        if idx_name and 'autoindex' in idx_name.lower():
            # В SQLite нельзя удалить автоматический индекс напрямую
            # Нужно пересоздать таблицу, но это делается в отдельной миграции
            pass
    
    # Создаем составной уникальный индекс на (name, group_id)
    try:
        op.create_index(
            'uq_exam_types_name_group',
            'exam_types',
            ['name', 'group_id'],
            unique=True
        )
    except Exception:
        pass  # Индекс может уже существовать
    
    # 3. Удаляем колонку name из exam (если она есть)
    if 'name' in exam_columns:
        with op.batch_alter_table('exam', schema=None) as batch_op:
            batch_op.drop_column('name')


def downgrade():
    connection = op.get_bind()
    inspector = sa.inspect(connection)
    
    exam_columns = [col['name'] for col in inspector.get_columns('exam')]
    exam_types_columns = [col['name'] for col in inspector.get_columns('exam_types')]

    # 1. Добавляем обратно name в exam
    if 'name' not in exam_columns:
        with op.batch_alter_table('exam', schema=None) as batch_op:
            batch_op.add_column(sa.Column('name', sa.String(100), nullable=True))
        
        # Заполняем name из exam_type
        connection.execute(sa.text("""
            UPDATE exam
            SET name = (
                SELECT name FROM exam_types WHERE exam_types.id = exam.exam_type_id
            )
            WHERE name IS NULL
        """))
        connection.commit()
        
        # Делаем name NOT NULL
        with op.batch_alter_table('exam', schema=None) as batch_op:
            batch_op.alter_column('name', existing_type=sa.String(100), nullable=False)

    # 2. Удаляем group_id из exam_types
    if 'group_id' in exam_types_columns:
        with op.batch_alter_table('exam_types', schema=None) as batch_op:
            try:
                batch_op.drop_constraint('fk_exam_types_group_id', type_='foreignkey')
            except Exception:
                pass
            batch_op.drop_column('group_id')

