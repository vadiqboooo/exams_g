"""add teacher_id to study_group

Revision ID: add_teacher_id
Revises: add_employees_table
Create Date: 2024-01-01 12:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'add_teacher_id'
down_revision = 'add_employees_table'
branch_labels = None
depends_on = None


def upgrade():
    connection = op.get_bind()
    
    # Проверяем, существует ли колонка teacher
    inspector = sa.inspect(connection)
    columns = [col['name'] for col in inspector.get_columns('study_group')]
    has_teacher_column = 'teacher' in columns
    has_teacher_id_column = 'teacher_id' in columns
    
    if has_teacher_id_column:
        # Колонка уже существует, пропускаем
        return
    
    # Для SQLite используем batch_alter_table для всех операций
    with op.batch_alter_table('study_group', schema=None) as batch_op:
        # Добавляем новую колонку teacher_id (сначала nullable)
        batch_op.add_column(sa.Column('teacher_id', sa.Integer(), nullable=True))
    
    # Если в базе есть данные с teacher (строка), пытаемся их мигрировать
    if has_teacher_column:
        # Пытаемся найти учителей по имени и сопоставить их с группами
        # Получаем все уникальные имена учителей из групп
        result = connection.execute(sa.text("SELECT DISTINCT teacher FROM study_group WHERE teacher IS NOT NULL"))
        teacher_names = [row[0] for row in result.fetchall()]
        
        # Для каждого имени учителя находим соответствующего сотрудника
        for teacher_name in teacher_names:
            if teacher_name:
                emp_result = connection.execute(
                    sa.text("SELECT id FROM employees WHERE teacher_name = :name AND role = 'teacher' LIMIT 1"),
                    {"name": teacher_name}
                )
                emp_row = emp_result.fetchone()
                if emp_row:
                    teacher_id = emp_row[0]
                    # Обновляем группы с этим учителем
                    connection.execute(
                        sa.text("UPDATE study_group SET teacher_id = :teacher_id WHERE teacher = :name AND teacher_id IS NULL"),
                        {"teacher_id": teacher_id, "name": teacher_name}
                    )
        
        # Если остались группы без teacher_id, используем первого учителя как дефолт
        result = connection.execute(sa.text("SELECT id FROM employees WHERE role = 'teacher' LIMIT 1"))
        teacher_row = result.fetchone()
        if teacher_row:
            default_teacher_id = teacher_row[0]
            connection.execute(
                sa.text("UPDATE study_group SET teacher_id = :teacher_id WHERE teacher_id IS NULL"),
                {"teacher_id": default_teacher_id}
            )
    else:
        # Если колонки teacher нет, используем первого учителя как дефолт
        result = connection.execute(sa.text("SELECT id FROM employees WHERE role = 'teacher' LIMIT 1"))
        teacher_row = result.fetchone()
        if teacher_row:
            default_teacher_id = teacher_row[0]
            connection.execute(
                sa.text("UPDATE study_group SET teacher_id = :teacher_id WHERE teacher_id IS NULL"),
                {"teacher_id": default_teacher_id}
            )
    
    connection.commit()
    
    # Теперь делаем колонку NOT NULL и создаем внешний ключ через batch_alter_table
    with op.batch_alter_table('study_group', schema=None) as batch_op:
        batch_op.alter_column('teacher_id', nullable=False)
        # Создаем внешний ключ
        batch_op.create_foreign_key(
            'fk_study_group_teacher_id',
            'employees',
            ['teacher_id'], ['id']
        )
        # Удаляем старую колонку teacher (если она существует)
        if has_teacher_column:
            try:
                batch_op.drop_column('teacher')
            except Exception:
                pass


def downgrade():
    # Добавляем обратно колонку teacher
    op.add_column('study_group', sa.Column('teacher', sa.String(200), nullable=True))
    
    # Заполняем teacher из teacher_name учителя
    connection = op.get_bind()
    connection.execute(sa.text("""
        UPDATE study_group 
        SET teacher = (
            SELECT teacher_name 
            FROM employees 
            WHERE employees.id = study_group.teacher_id
        )
    """))
    connection.commit()
    
    # Делаем teacher NOT NULL
    op.alter_column('study_group', 'teacher', nullable=False)
    
    # Удаляем внешний ключ
    op.drop_constraint('fk_study_group_teacher_id', 'study_group', type_='foreignkey')
    
    # Удаляем колонку teacher_id
    op.drop_column('study_group', 'teacher_id')

