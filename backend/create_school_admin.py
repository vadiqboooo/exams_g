"""
Скрипт для создания администраторов школ
"""
import sys
from pathlib import Path

# Добавляем путь к backend для импорта моделей
sys.path.append(str(Path(__file__).parent))

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from models import Employee
import bcrypt

# Синхронное подключение к SQLite
DATABASE_URL = "sqlite:///./school.db"

# Хеширование паролей
def hash_password(password: str) -> str:
    """Хеширует пароль с автоматической обрезкой до 72 байт"""
    password_bytes = password.encode('utf-8')[:72]
    hashed = bcrypt.hashpw(password_bytes, bcrypt.gensalt())
    return hashed.decode('utf-8')

def create_school_admins():
    """Создать администраторов школ"""
    engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    db = SessionLocal()

    try:
        print("Sozdanie administratorov shkol...")

        # Администраторы для создания
        admins = [
            {
                "username": "admin_baikalskaya",
                "password": "baikalskaya123",
                "teacher_name": "Администратор Байкальская",
                "school": "Байкальская",
                "role": "school_admin"
            },
            {
                "username": "admin_lermontova",
                "password": "lermontova123",
                "teacher_name": "Администратор Лермонтова",
                "school": "Лермонтова",
                "role": "school_admin"
            }
        ]

        for admin_data in admins:
            # Проверяем, существует ли уже такой пользователь
            existing = db.query(Employee).filter(Employee.username == admin_data["username"]).first()

            if existing:
                print(f"  [INFO] Polzovatel '{admin_data['username']}' uzhe suschestvuet")
                continue

            # Создаем нового администратора
            new_admin = Employee(
                username=admin_data["username"],
                password_hash=hash_password(admin_data["password"]),
                teacher_name=admin_data["teacher_name"],
                school=admin_data["school"],
                role=admin_data["role"]
            )

            db.add(new_admin)
            db.commit()

            print(f"  [OK] Sozdan administrator: {admin_data['teacher_name']}")
            print(f"    - Username: {admin_data['username']}")
            print(f"    - Password: {admin_data['password']}")
            print(f"    - School: {admin_data['school']}")
            print()

        print("[SUCCESS] Administratory shkol sozdany uspeshno!")
        print("\nDannye dlya vhoda:")
        print("-" * 50)
        for admin_data in admins:
            print(f"School: {admin_data['school']}")
            print(f"  Username: {admin_data['username']}")
            print(f"  Password: {admin_data['password']}")
            print()

    except Exception as e:
        print(f"\n[ERROR] Oshibka pri sozdanii administratorov: {e}")
        db.rollback()
        raise
    finally:
        db.close()

if __name__ == "__main__":
    create_school_admins()
