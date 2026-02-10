"""
Скрипт миграции: добавление completed_at в таблицу tasks
"""
import sys
from pathlib import Path

sys.path.append(str(Path(__file__).parent))

from sqlalchemy import create_engine, text

DATABASE_URL = "sqlite:///./school.db"


def migrate():
    engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})

    migrations = [
        ("tasks", "completed_at", "DATETIME"),
        ("tasks", "deadline_type", "VARCHAR(20)"),
        ("tasks", "linked_students", "JSON"),
        ("reports", "work_start_time", "DATETIME"),
        ("reports", "work_end_time", "DATETIME"),
    ]

    with engine.connect() as conn:
        for table, column, col_type in migrations:
            try:
                conn.execute(text(f"ALTER TABLE {table} ADD COLUMN {column} {col_type}"))
                conn.commit()
                print(f"[OK] Добавлена колонка: {table}.{column}")
            except Exception as e:
                if "duplicate column" in str(e).lower():
                    print(f"[INFO] Колонка '{table}.{column}' уже существует")
                else:
                    print(f"[ERROR] {e}")
                    raise

    print("[SUCCESS] Миграция завершена!")


if __name__ == "__main__":
    migrate()
