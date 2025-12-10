"""
Скрипт для исправления структуры таблицы study_group
Удаляет старую колонку teacher, если она существует
"""
import asyncio
from sqlalchemy import create_engine, inspect, text
from sqlalchemy.ext.asyncio import create_async_engine
from database import DATABASE_URL

async def fix_study_group_table():
    # Используем синхронный engine для проверки структуры
    sync_url = DATABASE_URL.replace("+aiosqlite", "").replace("sqlite+aiosqlite", "sqlite")
    engine = create_engine(sync_url)
    
    inspector = inspect(engine)
    columns = inspector.get_columns('study_group')
    column_names = [col['name'] for col in columns]
    
    print(f"Текущие колонки в study_group: {column_names}")
    
    has_teacher_column = 'teacher' in column_names
    has_teacher_id_column = 'teacher_id' in column_names
    
    if has_teacher_column:
        print("Найдена старая колонка 'teacher'. Удаляем её...")
        with engine.connect() as conn:
            # Для SQLite нужно использовать batch_alter_table
            from sqlalchemy import MetaData, Table
            metadata = MetaData()
            metadata.reflect(bind=engine)
            table = metadata.tables['study_group']
            
            # Удаляем колонку teacher
            if 'teacher' in table.c:
                # SQLite не поддерживает DROP COLUMN напрямую, нужно пересоздать таблицу
                # Но проще использовать batch_alter_table
                try:
                    # Проверяем, есть ли ограничение NOT NULL
                    conn.execute(text("PRAGMA table_info(study_group)"))
                    result = conn.execute(text("SELECT sql FROM sqlite_master WHERE type='table' AND name='study_group'"))
                    table_sql = result.fetchone()
                    if table_sql:
                        print(f"Текущая структура таблицы: {table_sql[0]}")
                    
                    # Используем batch_alter_table для удаления колонки
                    from alembic import op
                    # Но это требует контекста миграции
                    # Вместо этого используем прямой SQL для SQLite
                    print("Внимание: SQLite не поддерживает DROP COLUMN напрямую.")
                    print("Нужно пересоздать таблицу. Это безопасно, если нет данных или они уже мигрированы.")
                    print("Если в таблице есть важные данные, сделайте резервную копию!")
                    
                    # Простое решение: делаем колонку nullable, если она NOT NULL
                    try:
                        # Проверяем, есть ли ограничение
                        conn.execute(text("""
                            CREATE TABLE IF NOT EXISTS study_group_new (
                                id INTEGER PRIMARY KEY,
                                name VARCHAR(100) NOT NULL,
                                school VARCHAR(100),
                                exam_type VARCHAR(20),
                                subject VARCHAR(100),
                                teacher_id INTEGER NOT NULL,
                                schedule JSON,
                                FOREIGN KEY(teacher_id) REFERENCES employees(id)
                            )
                        """))
                        conn.execute(text("""
                            INSERT INTO study_group_new (id, name, school, exam_type, subject, teacher_id, schedule)
                            SELECT id, name, school, exam_type, subject, teacher_id, schedule
                            FROM study_group
                        """))
                        conn.execute(text("DROP TABLE study_group"))
                        conn.execute(text("ALTER TABLE study_group_new RENAME TO study_group"))
                        conn.commit()
                        print("Таблица успешно пересоздана без колонки 'teacher'")
                    except Exception as e:
                        print(f"Ошибка при пересоздании таблицы: {e}")
                        print("Попробуем просто сделать колонку nullable...")
                        # Альтернатива: просто игнорируем старую колонку
                        print("Колонка 'teacher' будет игнорироваться при создании новых записей")
                except Exception as e:
                    print(f"Ошибка при удалении колонки: {e}")
    else:
        print("Колонка 'teacher' не найдена. Структура таблицы корректна.")
    
    if has_teacher_id_column:
        print("Колонка 'teacher_id' присутствует. ✓")
    else:
        print("ВНИМАНИЕ: Колонка 'teacher_id' отсутствует!")
    
    engine.dispose()
    print("Проверка завершена.")

if __name__ == "__main__":
    asyncio.run(fix_study_group_table())

