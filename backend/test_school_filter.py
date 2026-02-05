"""
Тест фильтрации групп по школам
"""
import sys
from pathlib import Path

sys.path.append(str(Path(__file__).parent))

from sqlalchemy import create_engine, select
from sqlalchemy.orm import sessionmaker
from models import StudyGroup, Employee

DATABASE_URL = "sqlite:///./school.db"

def test_school_filter():
    """Тестируем фильтрацию групп по школе"""
    engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
    Session = sessionmaker(bind=engine)
    session = Session()

    print("=== TEST SHKOL'NOJ FIL'TRACII ===\n")

    # Получаем школы администраторов
    admins = session.execute(
        select(Employee.username, Employee.school)
        .where(Employee.role == 'school_admin')
    ).all()

    print("Administratory:")
    for username, school in admins:
        print(f"  - {username}: '{school}'")
    print()

    # Получаем уникальные школы из групп
    schools_in_groups = session.execute(
        select(StudyGroup.school).distinct()
    ).all()

    print("Shkoly v gruppah:")
    for (school,) in schools_in_groups:
        if school:
            print(f"  - '{school}'")
    print()

    # Для каждого администратора проверяем фильтрацию
    for username, admin_school in admins:
        if not admin_school:
            continue

        groups = session.execute(
            select(StudyGroup.id, StudyGroup.name, StudyGroup.school)
            .where(StudyGroup.school == admin_school)
        ).all()

        print(f"Gruppy dlja {username} (school='{admin_school}'):")
        if groups:
            for group_id, name, school in groups:
                print(f"  - [ID: {group_id}] {name} (school: '{school}')")
        else:
            print(f"  NE NAJDENO GRUPP!")
            # Проверяем, есть ли группы с похожим названием
            all_groups = session.execute(
                select(StudyGroup.school).distinct()
            ).all()
            print(f"  Vse shkoly v BD: {[repr(s[0]) for s in all_groups]}")
        print()

    session.close()

if __name__ == "__main__":
    test_school_filter()
