from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload
from sqlalchemy import func
from typing import List
from datetime import datetime, timedelta
import re

from database import get_db
from models import Student, StudyGroup, ExamRegistration, group_student_association, Probnik
import schemas

router = APIRouter(prefix="/telegram", tags=["telegram"])

# Предметы для ОГЭ и ЕГЭ
OGE_SUBJECTS = [
    "Русский язык",
    "Математика",
    "Обществознание",
    "История",
    "Биология",
    "Химия",
    "Физика",
    "Информатика",
    "География",
    "Английский язык",
    "Литература"
]

EGE_SUBJECTS = [
    "Русский язык",
    "Математика (профиль)",
    "Математика (база)",
    "Обществознание",
    "История",
    "Биология",
    "Химия",
    "Физика",
    "Информатика",
    "География",
    "Английский язык",
    "Литература"
]

@router.get("/student-by-user-id/{user_id}", response_model=schemas.StudentSearchResponse)
async def get_student_by_user_id(
    user_id: int,
    db: AsyncSession = Depends(get_db)
):
    """Получение студента по Telegram user_id"""
    result = await db.execute(
        select(Student)
        .options(selectinload(Student.groups))
        .where(Student.user_id == user_id)
    )
    student = result.scalar_one_or_none()
    
    if not student:
        raise HTTPException(status_code=404, detail="Ученик не найден")
    
    # Получаем названия групп
    group_names = [group.name for group in student.groups]
    
    # Обрабатываем class_num: преобразуем пустые строки в None
    class_num = student.class_num
    if class_num == '' or class_num is None:
        class_num = None
    elif isinstance(class_num, str):
        # Если это строка, пытаемся преобразовать в int
        try:
            class_num = int(class_num) if class_num.strip() else None
        except (ValueError, AttributeError):
            class_num = None
    
    return schemas.StudentSearchResponse(
        id=student.id,
        fio=student.fio,
        groups=group_names,
        class_num=class_num
    )

@router.post("/search-student", response_model=List[schemas.StudentSearchResponse])
async def search_student(
    request: schemas.StudentSearchRequest,
    db: AsyncSession = Depends(get_db)
):
    """Поиск ученика по ФИО"""
    # Ищем студентов по ФИО (без учета регистра)
    # Для SQLite используем func.lower() вместо ilike
    fio_search = request.fio.strip()
    
    if not fio_search:
        return []
    
    # Нормализуем поисковый запрос (убираем лишние пробелы)
    fio_search_normalized = " ".join(fio_search.split())
    fio_lower = fio_search_normalized.lower()
    
    # Создаем паттерн для поиска (поддерживаем поиск по части имени)
    search_pattern = f"%{fio_lower}%"
    
    # Получаем всех студентов с группами
    # Используем try-except для обработки ошибок при загрузке данных с пустыми строками в полях DateTime
    try:
        result = await db.execute(
            select(Student)
            .options(selectinload(Student.groups))
        )
        all_students = result.scalars().all()
    except Exception as e:
        # Если произошла ошибка при загрузке (например, пустые строки в полях DateTime),
        # пытаемся загрузить без selectinload и обрабатываем ошибки для каждого студента
        result = await db.execute(select(Student))
        all_students_raw = result.scalars().all()
        all_students = []
        for student in all_students_raw:
            try:
                # Пытаемся загрузить группы для каждого студента отдельно
                await db.refresh(student, ["groups"])
                all_students.append(student)
            except Exception:
                # Если не удалось загрузить группы, добавляем студента без групп
                all_students.append(student)
    
    # Фильтруем студентов: сначала по фамилии, потом по имени
    # ФИО в базе: "Фамилия Имя"
    search_words = fio_lower.split()
    matched_students = []
    
    for student in all_students:
        student_fio_normalized = " ".join(student.fio.strip().split())
        student_fio_lower = student_fio_normalized.lower()
        student_fio_parts = student_fio_lower.split()
        
        if len(student_fio_parts) < 2:
            # Если в базе нет фамилии и имени, пропускаем
            continue
        
        student_surname = student_fio_parts[0]  # Фамилия
        student_name = student_fio_parts[1] if len(student_fio_parts) > 1 else ""  # Имя
        
        # Приоритет поиска:
        # 1. Точное совпадение ФИО
        # 2. Поиск по фамилии (начинается с фамилии)
        # 3. Поиск по имени (если фамилия не подошла)
        matches = False
        match_priority = 999  # Чем меньше, тем выше приоритет
        
        if student_fio_lower == fio_lower:
            # Точное совпадение
            matches = True
            match_priority = 0
        elif len(search_words) >= 1:
            # Ищем по первому слову (фамилия)
            search_surname = search_words[0]
            if student_surname.startswith(search_surname) or search_surname in student_surname:
                matches = True
                match_priority = 1
            elif len(search_words) >= 2:
                # Если есть второе слово, ищем по имени
                search_name = search_words[1]
                if student_name.startswith(search_name) or search_name in student_name:
                    matches = True
                    match_priority = 2
        
        if matches:
            matched_students.append((student, match_priority))
    
    # Сортируем по приоритету, потом по ФИО
    matched_students.sort(key=lambda x: (x[1], x[0].fio))
    matched_students = [student for student, _ in matched_students]
    
    response = []
    is_single_result = len(matched_students) == 1
    
    for student in matched_students:
        # Получаем названия групп только если найден один студент
        group_names = []
        if is_single_result:
            group_names = [group.name for group in student.groups]
        
        # Обрабатываем class_num: преобразуем пустые строки в None
        class_num = student.class_num
        if class_num == '' or class_num is None:
            class_num = None
        elif isinstance(class_num, str):
            # Если это строка, пытаемся преобразовать в int
            try:
                class_num = int(class_num) if class_num.strip() else None
            except (ValueError, AttributeError):
                class_num = None
        
        response.append(schemas.StudentSearchResponse(
            id=student.id,
            fio=student.fio,
            groups=group_names,
            class_num=class_num
        ))
    
    return response

@router.get("/debug/all-students")
async def debug_all_students(
    db: AsyncSession = Depends(get_db)
):
    """Отладочный endpoint для просмотра всех студентов в базе"""
    result = await db.execute(
        select(Student)
        .options(selectinload(Student.groups))
    )
    students = result.scalars().all()
    
    response = []
    for student in students:
        group_names = [group.name for group in student.groups]
        response.append({
            "id": student.id,
            "fio": student.fio,
            "fio_lower": student.fio.lower(),
            "groups": group_names,
            "class_num": student.class_num
        })
    
    return {"total": len(response), "students": response}

@router.post("/confirm-student")
async def confirm_student(
    request: schemas.StudentConfirmRequest,
    db: AsyncSession = Depends(get_db)
):
    """Подтверждение ученика и привязка Telegram ID"""
    result = await db.execute(
        select(Student).where(Student.id == request.student_id)
    )
    student = result.scalar_one_or_none()
    
    if not student:
        raise HTTPException(status_code=404, detail="Ученик не найден")
    
    # Обновляем user_id и время подтверждения
    student.user_id = request.user_id
    student.confirmed_at = datetime.utcnow()
    await db.commit()
    await db.refresh(student)
    
    return {"message": "Ученик подтвержден", "class_num": student.class_num}

@router.get("/subjects/{class_num}", response_model=schemas.SubjectListResponse)
async def get_subjects(class_num: int, db: AsyncSession = Depends(get_db)):
    """Получение списка предметов в зависимости от класса"""
    if class_num == 9:
        return schemas.SubjectListResponse(subjects=OGE_SUBJECTS)
    elif class_num in [10, 11]:
        return schemas.SubjectListResponse(subjects=EGE_SUBJECTS)
    else:
        raise HTTPException(status_code=400, detail="Некорректный класс")


@router.get("/active-probnik")
async def get_active_probnik(db: AsyncSession = Depends(get_db)):
    """Получение активного пробника для телеграм-бота"""
    result = await db.execute(select(Probnik).where(Probnik.is_active == True))
    probnik = result.scalar_one_or_none()
    
    if not probnik:
        return None
    
    return {
        "id": probnik.id,
        "name": probnik.name,
        "is_active": probnik.is_active,
        "slots_baikalskaya": probnik.slots_baikalskaya,
        "slots_lermontova": probnik.slots_lermontova,
        "exam_dates": probnik.exam_dates,
        "exam_times": probnik.exam_times,
        "exam_dates_baikalskaya": probnik.exam_dates_baikalskaya,
        "exam_dates_lermontova": probnik.exam_dates_lermontova,
        "exam_times_baikalskaya": probnik.exam_times_baikalskaya,
        "exam_times_lermontova": probnik.exam_times_lermontova,
        "max_registrations": probnik.max_registrations if probnik.max_registrations is not None else 4
    }


@router.get("/users-with-telegram")
async def get_users_with_telegram(db: AsyncSession = Depends(get_db)):
    """Получение всех пользователей с привязанным Telegram ID"""
    result = await db.execute(
        select(Student).where(
            Student.user_id.isnot(None),
            Student.user_id > 0
        )
    )
    students = result.scalars().all()
    
    return {
        "users": [{"user_id": s.user_id, "fio": s.fio} for s in students]
    }

@router.post("/register-exam", response_model=schemas.ExamRegistrationResponse)
async def register_exam(
    registration: schemas.ExamRegistrationCreate,
    db: AsyncSession = Depends(get_db)
):
    """Запись на экзамен"""
    # Проверяем, что студент существует
    result = await db.execute(
        select(Student).where(Student.id == registration.student_id)
    )
    student = result.scalar_one_or_none()
    
    if not student:
        raise HTTPException(status_code=404, detail="Ученик не найден")
    
    # Получаем активный пробник
    probnik_result = await db.execute(select(Probnik).where(Probnik.is_active == True))
    active_probnik = probnik_result.scalar_one_or_none()
    
    # Получаем максимальное количество записей из активного пробника
    max_registrations = 4  # Значение по умолчанию
    if active_probnik:
        max_registrations = active_probnik.max_registrations if active_probnik.max_registrations is not None else 4
    
    # Проверяем, что ученик не записался уже на максимальное количество экзаменов для активного пробника
    if active_probnik:
        existing_registrations = await db.execute(
            select(ExamRegistration).where(
                ExamRegistration.student_id == registration.student_id,
                ExamRegistration.probnik_id == active_probnik.id
            )
        )
        existing_count = len(existing_registrations.scalars().all())
        
        if existing_count >= max_registrations:
            raise HTTPException(status_code=400, detail=f"Можно записаться максимум на {max_registrations} экзаменов")
    
    # Парсим дату и время
    try:
        exam_date_obj = datetime.strptime(registration.exam_date, "%Y-%m-%d").date()
    except ValueError:
        raise HTTPException(status_code=400, detail="Некорректный формат даты. Используйте YYYY-MM-DD")
    
    # Проверяем количество записей на этот день и время для активного пробника
    if active_probnik:
        count_query = select(ExamRegistration).where(
            ExamRegistration.exam_date == exam_date_obj,
            ExamRegistration.exam_time == registration.exam_time,
            ExamRegistration.probnik_id == active_probnik.id
        )
        if registration.school:
            count_query = count_query.where(ExamRegistration.school == registration.school)
        
        count_result = await db.execute(count_query)
        registrations_count = len(count_result.scalars().all())
        
        # Определяем лимит из пробника
        limit = 45  # Значение по умолчанию
        if registration.school:
            if registration.school == "Байкальская" and active_probnik.slots_baikalskaya:
                limit = active_probnik.slots_baikalskaya.get(registration.exam_time, 45)
            elif registration.school == "Лермонтова" and active_probnik.slots_lermontova:
                limit = active_probnik.slots_lermontova.get(registration.exam_time, 45)
        
        if registrations_count >= limit:
            raise HTTPException(status_code=400, detail="На это время нет свободных мест")
        
        # Проверяем, что ученик не записался уже на этот же экзамен в этом пробнике
        duplicate_result = await db.execute(
            select(ExamRegistration).where(
                ExamRegistration.student_id == registration.student_id,
                ExamRegistration.subject == registration.subject,
                ExamRegistration.exam_date == exam_date_obj,
                ExamRegistration.exam_time == registration.exam_time,
                ExamRegistration.probnik_id == active_probnik.id
            )
        )
        if duplicate_result.scalar_one_or_none():
            raise HTTPException(status_code=400, detail="Вы уже записаны на этот экзамен")
    
    # Создаем запись (exam_date хранится как DateTime, но используем только дату)
    exam_datetime = datetime.combine(exam_date_obj, datetime.min.time())
    db_registration = ExamRegistration(
        student_id=registration.student_id,
        subject=registration.subject,
        exam_date=exam_datetime,
        exam_time=registration.exam_time,
        school=registration.school,
        probnik_id=active_probnik.id if active_probnik else None
    )
    db.add(db_registration)
    await db.commit()
    await db.refresh(db_registration)
    
    return schemas.ExamRegistrationResponse(
        id=db_registration.id,
        student_id=db_registration.student_id,
        subject=db_registration.subject,
        exam_date=db_registration.exam_date.strftime("%Y-%m-%d"),
        exam_time=db_registration.exam_time,
        school=db_registration.school,
        created_at=db_registration.created_at.isoformat() if db_registration.created_at else "",
        confirmed=db_registration.confirmed,
        confirmed_at=db_registration.confirmed_at.isoformat() if db_registration.confirmed_at else None,
        attended=getattr(db_registration, 'attended', False),
        submitted_work=getattr(db_registration, 'submitted_work', False)
    )

@router.get("/available-slots/{date}")
async def get_available_slots(date: str, school: str = None, db: AsyncSession = Depends(get_db)):
    """Получение доступных слотов на дату"""
    try:
        exam_date = datetime.strptime(date, "%Y-%m-%d").date()
    except ValueError:
        raise HTTPException(status_code=400, detail="Некорректный формат даты")
    
    # Получаем активный пробник для определения лимитов
    probnik_result = await db.execute(select(Probnik).where(Probnik.is_active == True))
    probnik = probnik_result.scalar_one_or_none()
    
    # Определяем времена и лимиты из пробника с учетом школы и даты
    times = ["9:00", "12:00"]
    default_limit = 45
    
    if probnik:
        # Пытаемся найти времена для конкретной даты
        dates_list = None
        if school:
            if school == "Байкальская" and probnik.exam_dates_baikalskaya:
                dates_list = probnik.exam_dates_baikalskaya
            elif school == "Лермонтова" and probnik.exam_dates_lermontova:
                dates_list = probnik.exam_dates_lermontova
        
        if dates_list:
            for d in dates_list:
                if d.get("date") == date and d.get("times"):
                    times = d["times"]
                    break
        
        # Если не нашли времена для конкретной даты, используем fallback
        if times == ["9:00", "12:00"]:
            if school:
                if school == "Байкальская" and probnik.exam_times_baikalskaya:
                    times = probnik.exam_times_baikalskaya
                elif school == "Лермонтова" and probnik.exam_times_lermontova:
                    times = probnik.exam_times_lermontova
                # Если специфичных времен нет, используем общие
                elif probnik.exam_times:
                    times = probnik.exam_times
            else:
                # Если школа не указана, используем общие времена
                if probnik.exam_times:
                    times = probnik.exam_times
    
    slots = {}
    
    for time in times:
        # Создаем datetime для сравнения
        exam_datetime = datetime.combine(exam_date, datetime.min.time())
        
        # Считаем записи с учетом школы и активного пробника
        query = select(ExamRegistration).where(
            ExamRegistration.exam_date == exam_datetime,
            ExamRegistration.exam_time == time
        )
        
        # Фильтруем по активному пробнику
        if probnik:
            query = query.where(ExamRegistration.probnik_id == probnik.id)
        else:
            # Если нет активного пробника, возвращаем пустые слоты
            slots[time] = {
                "registered": 0,
                "available": 0
            }
            continue
        
        if school:
            query = query.where(ExamRegistration.school == school)
        
        count_result = await db.execute(query)
        count = len(count_result.scalars().all())
        
        # Определяем лимит из пробника
        limit = default_limit
        if probnik and school:
            if school == "Байкальская" and probnik.slots_baikalskaya:
                limit = probnik.slots_baikalskaya.get(time, default_limit)
            elif school == "Лермонтова" and probnik.slots_lermontova:
                limit = probnik.slots_lermontova.get(time, default_limit)
        
        slots[time] = {
            "registered": count,
            "available": max(0, limit - count)
        }
    
    return {"date": date, "slots": slots}

@router.get("/student-registrations/{student_id}", response_model=List[schemas.ExamRegistrationResponse])
async def get_student_registrations(
    student_id: int,
    db: AsyncSession = Depends(get_db)
):
    """Получение записей ученика для активного пробника"""
    # Получаем активный пробник
    probnik_result = await db.execute(select(Probnik).where(Probnik.is_active == True))
    active_probnik = probnik_result.scalar_one_or_none()
    
    # Если есть активный пробник, фильтруем записи по нему
    if active_probnik:
        result = await db.execute(
            select(ExamRegistration).where(
                ExamRegistration.student_id == student_id,
                ExamRegistration.probnik_id == active_probnik.id
            )
        )
    else:
        # Если нет активного пробника, возвращаем пустой список
        return []
    
    registrations = result.scalars().all()
    
    result_list = []
    for r in registrations:
        # Безопасная обработка exam_date
        exam_date_str = ""
        if r.exam_date:
            if isinstance(r.exam_date, datetime):
                exam_date_str = r.exam_date.date().strftime("%Y-%m-%d")
            elif isinstance(r.exam_date, str) and r.exam_date.strip():
                # Если это строка, пытаемся преобразовать
                try:
                    exam_date_str = datetime.fromisoformat(r.exam_date).date().strftime("%Y-%m-%d")
                except (ValueError, AttributeError):
                    exam_date_str = ""
        
        result_list.append(schemas.ExamRegistrationResponse(
            id=r.id,
            student_id=r.student_id,
            subject=r.subject,
            exam_date=exam_date_str,
            exam_time=r.exam_time,
            school=r.school,
            created_at=r.created_at.isoformat() if r.created_at else "",
            confirmed=r.confirmed,
            confirmed_at=r.confirmed_at.isoformat() if r.confirmed_at else None,
            attended=getattr(r, 'attended', False),
            submitted_work=getattr(r, 'submitted_work', False)
        ))
    
    return result_list

@router.post("/confirm-participation/{registration_id}")
async def confirm_participation(
    registration_id: int,
    db: AsyncSession = Depends(get_db)
):
    """Подтверждение участия в экзамене"""
    result = await db.execute(
        select(ExamRegistration).where(ExamRegistration.id == registration_id)
    )
    registration = result.scalar_one_or_none()
    
    if not registration:
        raise HTTPException(status_code=404, detail="Запись не найдена")
    
    registration.confirmed = True
    registration.confirmed_at = datetime.utcnow()
    await db.commit()
    
    return {"message": "Участие подтверждено"}

@router.delete("/registration/{registration_id}")
async def delete_registration(
    registration_id: int,
    db: AsyncSession = Depends(get_db)
):
    """Удаление записи на экзамен"""
    result = await db.execute(
        select(ExamRegistration).where(ExamRegistration.id == registration_id)
    )
    registration = result.scalar_one_or_none()
    
    if not registration:
        raise HTTPException(status_code=404, detail="Запись не найдена")
    
    await db.delete(registration)
    await db.commit()
    
    return {"message": "Запись удалена"}

@router.get("/pending-notifications")
async def get_pending_notifications(db: AsyncSession = Depends(get_db)):
    """Получение списка уведомлений для отправки"""
    now = datetime.utcnow()
    
    # Уведомления через 24 часа после подтверждения, но без записи
    # Находим студентов, которые подтвердили себя более 24 часов назад, но не записались на экзамен
    confirmed_students = await db.execute(
        select(Student).where(
            Student.user_id.isnot(None),
            Student.user_id > 0,
            Student.confirmed_at.isnot(None),
            Student.confirmed_at <= now - timedelta(hours=24)
        )
    )
    students = confirmed_students.scalars().all()
    
    # Получаем активный пробник
    probnik_result = await db.execute(select(Probnik).where(Probnik.is_active == True))
    active_probnik = probnik_result.scalar_one_or_none()
    
    notifications_24h = []
    # Отправляем уведомления только если есть активный пробник
    if active_probnik:
        for student in students:
            # Проверяем, есть ли у студента записи для активного пробника
            registrations_result = await db.execute(
                select(ExamRegistration).where(
                    ExamRegistration.student_id == student.id,
                    ExamRegistration.probnik_id == active_probnik.id
                )
            )
            registrations = registrations_result.scalars().all()
            
            # Если нет записей для активного пробника и прошло более 24 часов с подтверждения
            if not registrations:
                notifications_24h.append({
                    "user_id": student.user_id,
                    "type": "reminder_24h",
                    "message": "Вы подтвердили регистрацию более 24 часов назад, но еще не записались на экзамен. Пожалуйста, завершите регистрацию."
                })
    
    # Уведомления за 3 дня до экзамена (только для активного пробника)
    notifications_3d = []
    if active_probnik:
        three_days_later = now + timedelta(days=3)
        three_days_date = three_days_later.date()
        registrations_3d = await db.execute(
            select(ExamRegistration)
            .options(selectinload(ExamRegistration.student))
            .where(
                ExamRegistration.exam_date >= datetime.combine(three_days_date - timedelta(days=1), datetime.min.time()),
                ExamRegistration.exam_date <= datetime.combine(three_days_date, datetime.min.time()),
                ExamRegistration.confirmed == False,
                ExamRegistration.probnik_id == active_probnik.id
            )
        )
    
        for reg in registrations_3d.scalars().all():
            if reg.student and reg.student.user_id:
                notifications_3d.append({
                    "user_id": reg.student.user_id,
                    "type": "reminder_3d",
                    "registration_id": reg.id,
                    "subject": reg.subject,
                    "exam_date": reg.exam_date.strftime("%d.%m.%Y"),
                    "exam_time": reg.exam_time,
                    "message": f"Через 3 дня у вас экзамен по {reg.subject} ({reg.exam_date.strftime('%d.%m.%Y')} в {reg.exam_time}). Подтвердите участие."
                })
    
    # Уведомления за 1 день до экзамена (только для активного пробника)
    notifications_1d = []
    if active_probnik:
        one_day_later = now + timedelta(days=1)
        one_day_date = one_day_later.date()
        registrations_1d = await db.execute(
            select(ExamRegistration)
            .options(selectinload(ExamRegistration.student))
            .where(
                ExamRegistration.exam_date >= datetime.combine(one_day_date, datetime.min.time()),
                ExamRegistration.exam_date <= datetime.combine(one_day_date + timedelta(days=1), datetime.min.time()),
                ExamRegistration.confirmed == False,
                ExamRegistration.probnik_id == active_probnik.id
            )
        )
        
        for reg in registrations_1d.scalars().all():
            if reg.student and reg.student.user_id:
                notifications_1d.append({
                    "user_id": reg.student.user_id,
                    "type": "reminder_1d",
                    "registration_id": reg.id,
                    "subject": reg.subject,
                    "exam_date": reg.exam_date.strftime("%d.%m.%Y"),
                    "exam_time": reg.exam_time,
                    "message": f"Завтра у вас экзамен по {reg.subject} в {reg.exam_time}. Подтвердите участие."
                })
    
    return {
        "reminder_24h": notifications_24h,
        "reminder_3d": notifications_3d,
        "reminder_1d": notifications_1d
    }

