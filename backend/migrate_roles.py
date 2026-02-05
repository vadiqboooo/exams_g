"""
Скрипт миграции базы данных для добавления системы ролей
"""
import sys
from pathlib import Path

# Добавляем путь к backend для импорта моделей
sys.path.append(str(Path(__file__).parent))

from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
from models import Base, Employee, WorkSession, Task, Report

# Синхронное подключение к SQLite
DATABASE_URL = "sqlite:///./school.db"

def migrate_database():
    """Мигрировать базу данных"""
    engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    db = SessionLocal()

    try:
        print("Nachalo migracii bazy dannyh...")

        # 1. Добавляем колонку school в таблицу employees, если ее нет
        print("Dobavlenie kolonki 'school' v tablicu employees...")
        try:
            db.execute(text("ALTER TABLE employees ADD COLUMN school VARCHAR(100)"))
            db.commit()
            print("  [OK] Kolonka 'school' dobavlena")
        except Exception as e:
            if "duplicate column name" in str(e).lower():
                print("  [INFO] Kolonka 'school' uzhe suschestvuet")
            else:
                print(f"  [ERROR] Oshibka pri dobavlenii kolonki 'school': {e}")
                db.rollback()

        # 2. Мигрируем существующих admin в owner
        print("\nMigraciya suschestvuyuschih admin v owner...")
        result = db.execute(text("UPDATE employees SET role = 'owner' WHERE role = 'admin'"))
        db.commit()
        print(f"  [OK] Obnovleno zapisej: {result.rowcount}")

        # 3. Создаем новые таблицы
        print("\nSozdanie novyh tablic...")

        # Создаем таблицу work_sessions
        try:
            WorkSession.__table__.create(engine, checkfirst=True)
            print("  [OK] Tablica 'work_sessions' sozdana")
        except Exception as e:
            print(f"  [INFO] Tablica 'work_sessions': {e}")

        # Создаем таблицу tasks
        try:
            Task.__table__.create(engine, checkfirst=True)
            print("  [OK] Tablica 'tasks' sozdana")
        except Exception as e:
            print(f"  [INFO] Tablica 'tasks': {e}")

        # Создаем таблицу reports
        try:
            Report.__table__.create(engine, checkfirst=True)
            print("  [OK] Tablica 'reports' sozdana")
        except Exception as e:
            print(f"  [INFO] Tablica 'reports': {e}")

        print("\n[SUCCESS] Migraciya zavershena uspeshno!")

    except Exception as e:
        print(f"\n[ERROR] Oshibka pri migracii: {e}")
        db.rollback()
        raise
    finally:
        db.close()

if __name__ == "__main__":
    migrate_database()
