"""
Скрипт для исправления названий школ у администраторов
"""
import sys
from pathlib import Path

# Добавляем путь к backend для импорта моделей
sys.path.append(str(Path(__file__).parent))

from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
from models import Employee

# Синхронное подключение к SQLite
DATABASE_URL = "sqlite:///./school.db"

def fix_school_names():
    """Исправить названия школ у администраторов"""
    engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    db = SessionLocal()

    try:
        print("Ispravlenie nazvanij shkol...")

        # Обновляем школы для администраторов
        updates = [
            ("admin_baikalskaya", "Байкальская", "Администратор Байкальская"),
            ("admin_lermontova", "Лермонтова", "Администратор Лермонтова")
        ]

        for username, school, teacher_name in updates:
            result = db.query(Employee).filter(Employee.username == username).first()
            if result:
                result.school = school
                result.teacher_name = teacher_name
                print(f"  [OK] Obnovlen {username}: school={school}")
            else:
                print(f"  [INFO] Polzovatel {username} ne najden")

        db.commit()
        print("\n[SUCCESS] Nazvanija shkol ispravleny!")

    except Exception as e:
        print(f"\n[ERROR] Oshibka: {e}")
        db.rollback()
        raise
    finally:
        db.close()

if __name__ == "__main__":
    fix_school_names()
