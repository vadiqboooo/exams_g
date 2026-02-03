"""
Скрипт для добавления таблиц оценок в ОГЭ предметы
"""
import asyncio
from database import AsyncSessionLocal
from sqlalchemy import select
from models import Subject

# Таблицы оценок для ОГЭ предметов (примерные значения на основе реальных критериев)
OGE_GRADE_SCALES = {
    'math_9': [
        {"grade": 2, "min": 0, "max": 7},
        {"grade": 3, "min": 8, "max": 14},
        {"grade": 4, "min": 15, "max": 21},
        {"grade": 5, "min": 22, "max": 31}
    ],
    'rus_9': [
        {"grade": 2, "min": 0, "max": 14},
        {"grade": 3, "min": 15, "max": 22},
        {"grade": 4, "min": 23, "max": 28},
        {"grade": 5, "min": 29, "max": 33}
    ],
    'infa_9': [
        {"grade": 2, "min": 0, "max": 4},
        {"grade": 3, "min": 5, "max": 10},
        {"grade": 4, "min": 11, "max": 15},
        {"grade": 5, "min": 16, "max": 19}
    ],
    'soc_9': [
        {"grade": 2, "min": 0, "max": 13},
        {"grade": 3, "min": 14, "max": 22},
        {"grade": 4, "min": 23, "max": 29},
        {"grade": 5, "min": 30, "max": 37}
    ],
    'hist_9': [
        {"grade": 2, "min": 0, "max": 9},
        {"grade": 3, "min": 10, "max": 19},
        {"grade": 4, "min": 20, "max": 27},
        {"grade": 5, "min": 28, "max": 37}
    ],
    'phys_9': [
        {"grade": 2, "min": 0, "max": 10},
        {"grade": 3, "min": 11, "max": 21},
        {"grade": 4, "min": 22, "max": 33},
        {"grade": 5, "min": 34, "max": 43}
    ],
    'bio_9': [
        {"grade": 2, "min": 0, "max": 12},
        {"grade": 3, "min": 13, "max": 24},
        {"grade": 4, "min": 25, "max": 35},
        {"grade": 5, "min": 36, "max": 45}
    ],
    'geo_9': [
        {"grade": 2, "min": 0, "max": 11},
        {"grade": 3, "min": 12, "max": 18},
        {"grade": 4, "min": 19, "max": 25},
        {"grade": 5, "min": 26, "max": 30}
    ],
    'eng_9': [
        {"grade": 2, "min": 0, "max": 28},
        {"grade": 3, "min": 29, "max": 45},
        {"grade": 4, "min": 46, "max": 57},
        {"grade": 5, "min": 58, "max": 68}
    ],
    'chem_9': [
        {"grade": 2, "min": 0, "max": 9},
        {"grade": 3, "min": 10, "max": 20},
        {"grade": 4, "min": 21, "max": 30},
        {"grade": 5, "min": 31, "max": 40}
    ],
}


async def update_oge_subjects():
    """Добавляет таблицы оценок в ОГЭ предметы"""
    async with AsyncSessionLocal() as db:
        print("Начало обновления ОГЭ предметов...")

        for code, grade_scale in OGE_GRADE_SCALES.items():
            # Находим предмет по коду
            result = await db.execute(select(Subject).where(Subject.code == code))
            subject = result.scalar_one_or_none()

            if not subject:
                print(f"  [!] Предмет '{code}' не найден, пропускаем")
                continue

            if subject.exam_type != 'ОГЭ':
                print(f"  [!] Предмет '{code}' не является ОГЭ, пропускаем")
                continue

            # Обновляем таблицу оценок
            subject.grade_scale = grade_scale
            print(f"  [+] Обновлен предмет: {subject.name} ({code})")
            print(f"      Таблица оценок: {grade_scale}")

        await db.commit()
        print("\nОбновление завершено!")

        # Проверяем результат
        print("\nПроверка обновленных данных:")
        oge_subjects = await db.execute(
            select(Subject).where(Subject.exam_type == 'ОГЭ')
        )
        for subject in oge_subjects.scalars():
            has_scale = subject.grade_scale is not None and len(subject.grade_scale) > 0
            status = "[OK]" if has_scale else "[MISSING]"
            print(f"  {status} {subject.code}: {subject.name}")
            if has_scale:
                print(f"      {len(subject.grade_scale)} диапазона(ов) оценок")


if __name__ == "__main__":
    asyncio.run(update_oge_subjects())
