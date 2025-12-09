"""Скрипт для исправления уникального ограничения на exam_types.name"""
import sqlite3
import os

db_path = 'school.db'

if not os.path.exists(db_path):
    print(f"База данных {db_path} не найдена")
    exit(1)

conn = sqlite3.connect(db_path)
cursor = conn.cursor()

try:
    # Получаем список индексов
    cursor.execute("SELECT name, sql FROM sqlite_master WHERE type='index' AND tbl_name='exam_types'")
    indexes = cursor.fetchall()
    
    print("Найденные индексы на exam_types:")
    for idx_name, idx_sql in indexes:
        print(f"  - {idx_name}: {idx_sql}")
    
    # Удаляем уникальный индекс на name, если он существует
    # SQLite создает автоматический индекс для UNIQUE, обычно он называется sqlite_autoindex_exam_types_1
    for idx_name, idx_sql in indexes:
        if idx_name and 'autoindex' in idx_name.lower():
            print(f"\nУдаляем автоматический уникальный индекс: {idx_name}")
            try:
                cursor.execute(f"DROP INDEX IF EXISTS {idx_name}")
            except Exception as e:
                print(f"  Предупреждение: не удалось удалить индекс {idx_name}: {e}")
    
    # Проверяем, есть ли составной уникальный индекс
    has_composite = False
    for idx_name, idx_sql in indexes:
        if idx_sql and 'name' in idx_sql.lower() and 'group_id' in idx_sql.lower():
            has_composite = True
            print(f"Составной индекс уже существует: {idx_name}")
            break
    
    # Создаем составной уникальный индекс на (name, group_id)
    if not has_composite:
        print("\nСоздаем составной уникальный индекс на (name, group_id)")
        cursor.execute("""
            CREATE UNIQUE INDEX IF NOT EXISTS uq_exam_types_name_group 
            ON exam_types(name, group_id)
        """)
    
    conn.commit()
    print("\nИсправление завершено успешно!")
    
    # Проверяем результат
    cursor.execute("SELECT name, sql FROM sqlite_master WHERE type='index' AND tbl_name='exam_types'")
    indexes_after = cursor.fetchall()
    print("\nИндексы после исправления:")
    for idx_name, idx_sql in indexes_after:
        print(f"  - {idx_name}: {idx_sql}")
        
except Exception as e:
    conn.rollback()
    print(f"Ошибка: {e}")
    raise
finally:
    conn.close()

