"""Скрипт для пересоздания таблицы exam_types без UNIQUE на name"""
import sqlite3
import os

db_path = 'school.db'

if not os.path.exists(db_path):
    print(f"База данных {db_path} не найдена")
    exit(1)

conn = sqlite3.connect(db_path)
cursor = conn.cursor()

try:
    # Проверяем, существует ли таблица
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='exam_types'")
    if not cursor.fetchone():
        print("Таблица exam_types не найдена")
        exit(0)
    
    print("Начинаем пересоздание таблицы exam_types...")
    
    # 1. Создаем временную таблицу без UNIQUE на name
    print("1. Создаем временную таблицу...")
    cursor.execute("""
        CREATE TABLE exam_types_new (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name VARCHAR(100) NOT NULL,
            group_id INTEGER NOT NULL,
            FOREIGN KEY (group_id) REFERENCES study_group(id)
        )
    """)
    
    # 2. Копируем данные
    print("2. Копируем данные...")
    cursor.execute("""
        INSERT INTO exam_types_new (id, name, group_id)
        SELECT id, name, group_id FROM exam_types
    """)
    
    # 3. Удаляем старую таблицу
    print("3. Удаляем старую таблицу...")
    cursor.execute("DROP TABLE exam_types")
    
    # 4. Переименовываем новую таблицу
    print("4. Переименовываем таблицу...")
    cursor.execute("ALTER TABLE exam_types_new RENAME TO exam_types")
    
    # 5. Создаем составной уникальный индекс на (name, group_id)
    print("5. Создаем составной уникальный индекс...")
    cursor.execute("""
        CREATE UNIQUE INDEX IF NOT EXISTS uq_exam_types_name_group 
        ON exam_types(name, group_id)
    """)
    
    # 6. Восстанавливаем индекс на id, если он был
    cursor.execute("""
        CREATE INDEX IF NOT EXISTS ix_exam_types_id 
        ON exam_types(id)
    """)
    
    conn.commit()
    print("\nИсправление завершено успешно!")
    
    # Проверяем результат
    cursor.execute("SELECT name, sql FROM sqlite_master WHERE type='index' AND tbl_name='exam_types'")
    indexes = cursor.fetchall()
    print("\nИндексы после исправления:")
    for idx_name, idx_sql in indexes:
        print(f"  - {idx_name}")
    
    # Проверяем структуру таблицы
    cursor.execute("PRAGMA table_info(exam_types)")
    columns = cursor.fetchall()
    print("\nСтруктура таблицы exam_types:")
    for col in columns:
        print(f"  - {col[1]} ({col[2]})")
        
except Exception as e:
    conn.rollback()
    print(f"Ошибка: {e}")
    import traceback
    traceback.print_exc()
    raise
finally:
    conn.close()

