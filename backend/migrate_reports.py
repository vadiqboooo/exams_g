"""
Скрипт миграции для обновления таблицы reports
"""
import sys
from pathlib import Path

sys.path.append(str(Path(__file__).parent))

from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

DATABASE_URL = "sqlite:///./school.db"

def migrate_reports():
    """Добавить новые колонки в таблицу reports"""
    engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    db = SessionLocal()

    try:
        print("Migraciya tablicy reports...")

        # Список новых колонок
        columns = [
            "ALTER TABLE reports ADD COLUMN leads JSON",
            "ALTER TABLE reports ADD COLUMN trial_scheduled INTEGER DEFAULT 0",
            "ALTER TABLE reports ADD COLUMN trial_attended INTEGER DEFAULT 0",
            "ALTER TABLE reports ADD COLUMN notified_tomorrow VARCHAR(10)",
            "ALTER TABLE reports ADD COLUMN cancellations TEXT",
            "ALTER TABLE reports ADD COLUMN churn TEXT",
            "ALTER TABLE reports ADD COLUMN money JSON",
            "ALTER TABLE reports ADD COLUMN water VARCHAR(200)",
            "ALTER TABLE reports ADD COLUMN supplies_needed TEXT",
            "ALTER TABLE reports ADD COLUMN comments TEXT"
        ]

        for sql in columns:
            try:
                db.execute(text(sql))
                db.commit()
                col_name = sql.split("ADD COLUMN ")[1].split()[0]
                print(f"  [OK] Dobavlena kolonka: {col_name}")
            except Exception as e:
                if "duplicate column" in str(e).lower():
                    col_name = sql.split("ADD COLUMN ")[1].split()[0]
                    print(f"  [INFO] Kolonka '{col_name}' uzhe suschestvuet")
                else:
                    print(f"  [ERROR] Oshibka: {e}")
                db.rollback()

        # Делаем content nullable
        try:
            # SQLite не поддерживает ALTER COLUMN, поэтому пропускаем
            print("  [INFO] Pole content ostavleno kak est (SQLite ogranichenie)")
        except:
            pass

        # Заполняем completed_at для задач, которые завершены, но без метки времени
        try:
            result = db.execute(text(
                "UPDATE tasks SET completed_at = updated_at "
                "WHERE status = 'completed' AND completed_at IS NULL"
            ))
            db.commit()
            print(f"  [OK] Обновлено задач completed_at: {result.rowcount}")
        except Exception as e:
            print(f"  [ERROR] Ошибка обновления completed_at: {e}")
            db.rollback()

        print("\n[SUCCESS] Миграция завершена!")

    except Exception as e:
        print(f"\n[ERROR] Oshibka migracii: {e}")
        db.rollback()
        raise
    finally:
        db.close()

if __name__ == "__main__":
    migrate_reports()
