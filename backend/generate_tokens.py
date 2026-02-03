"""
Скрипт для генерации токенов доступа для существующих студентов
Запуск: python backend/generate_tokens.py
"""
import asyncio
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from database import AsyncSessionLocal
from models import Student
from crud import generate_access_token


async def generate_tokens_for_students():
    """Генерирует токены для всех студентов, у которых их нет"""
    async with AsyncSessionLocal() as db:
        # Получаем всех студентов без токенов
        result = await db.execute(
            select(Student).where(Student.access_token == None)
        )
        students = result.scalars().all()

        if not students:
            print("Все студенты уже имеют токены доступа.")
            return

        print(f"Найдено студентов без токенов: {len(students)}")

        # Генерируем токены
        for student in students:
            student.access_token = generate_access_token()
            print(f"Сгенерирован токен для студента: {student.fio} (ID: {student.id})")

        # Сохраняем изменения
        await db.commit()
        print(f"\nТокены успешно сгенерированы для {len(students)} студентов!")


if __name__ == "__main__":
    asyncio.run(generate_tokens_for_students())
