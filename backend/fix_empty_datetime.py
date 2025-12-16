"""
Скрипт для исправления пустых строк в полях базы данных.
Заменяет пустые строки на NULL в полях DateTime и Integer.
"""
import sqlite3
from pathlib import Path

def fix_empty_datetime_fields():
    """Исправляет пустые строки в полях DateTime"""
    backend_dir = Path(__file__).resolve().parent
    db_path = backend_dir / "school.db"
    
    if not db_path.exists():
        print(f"База данных не найдена: {db_path}")
        return
    
    conn = sqlite3.connect(str(db_path))
    cursor = conn.cursor()
    
    try:
        # Исправляем поле confirmed_at в таблице student
        print("Исправляю поле confirmed_at в таблице student...")
        cursor.execute("""
            UPDATE student 
            SET confirmed_at = NULL 
            WHERE confirmed_at = '' OR confirmed_at IS NULL
        """)
        affected_confirmed_at = cursor.rowcount
        print(f"Исправлено записей confirmed_at: {affected_confirmed_at}")
        
        # Исправляем поле class_num в таблице student (пустые строки -> NULL)
        print("Исправляю поле class_num в таблице student...")
        cursor.execute("""
            UPDATE student 
            SET class_num = NULL 
            WHERE class_num = '' OR class_num IS NULL
        """)
        affected_class_num = cursor.rowcount
        print(f"Исправлено записей class_num: {affected_class_num}")
        
        # Исправляем поля exam_date, created_at, confirmed_at в таблице exam_registration
        print("Исправляю поля DateTime в таблице exam_registration...")
        cursor.execute("""
            UPDATE exam_registration 
            SET exam_date = NULL 
            WHERE exam_date = '' OR (exam_date IS NOT NULL AND exam_date = '')
        """)
        affected_exam_date = cursor.rowcount
        
        cursor.execute("""
            UPDATE exam_registration 
            SET created_at = NULL 
            WHERE created_at = '' OR (created_at IS NOT NULL AND created_at = '')
        """)
        affected_created_at = cursor.rowcount
        
        cursor.execute("""
            UPDATE exam_registration 
            SET confirmed_at = NULL 
            WHERE confirmed_at = '' OR (confirmed_at IS NOT NULL AND confirmed_at = '')
        """)
        affected_confirmed_at = cursor.rowcount
        
        print(f"Исправлено записей в exam_registration:")
        print(f"  - exam_date: {affected_exam_date}")
        print(f"  - created_at: {affected_created_at}")
        print(f"  - confirmed_at: {affected_confirmed_at}")
        
        conn.commit()
        print("\n✅ Исправление завершено успешно!")
        
    except Exception as e:
        conn.rollback()
        print(f"❌ Ошибка при исправлении: {e}")
        raise
    finally:
        conn.close()

if __name__ == "__main__":
    fix_empty_datetime_fields()

