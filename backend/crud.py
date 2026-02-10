from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload
from models import Student, Exam, StudyGroup, Employee, ExamType, Subject, WorkSession, Task, Report, Lesson, LessonAttendance
from schemas import StudentCreate, StudentUpdate, ExamCreate, ExamUpdate, GroupCreate, GroupUpdate, SubjectCreate, SubjectUpdate
from typing import List, Optional
from datetime import datetime, timedelta
import json
import secrets

# ==================== HELPER FUNCTIONS ====================

def generate_access_token() -> str:
    """Генерирует уникальный токен для доступа к результатам студента"""
    return secrets.token_urlsafe(32)

# ==================== EMPLOYEE CRUD ====================

async def get_employee(db: AsyncSession, employee_id: int):
    """Получить сотрудника по ID"""
    result = await db.execute(
        select(Employee).where(Employee.id == employee_id)
    )
    return result.scalar_one_or_none()

# ==================== STUDENT CRUD ====================

async def create_student(db: AsyncSession, student: StudentCreate):
    # Проверяем, существует ли уже студент с таким ФИО
    existing_student = await db.execute(
        select(Student).where(Student.fio == student.fio)
    )
    if existing_student.scalar_one_or_none():
        raise ValueError(f"Студент с именем '{student.fio}' уже существует")

    # Создаем студента с уникальным токеном
    student_data = student.dict()
    student_data['access_token'] = generate_access_token()

    db_student = Student(**student_data)
    db.add(db_student)
    await db.commit()
    await db.refresh(db_student)
    return db_student

async def get_students(db: AsyncSession, skip: int = 0, limit: int = 100):
    result = await db.execute(
        select(Student)
        .options(selectinload(Student.exam_registrations))
    )
    return result.scalars().all()

async def get_student(db: AsyncSession, student_id: int):
    result = await db.execute(
        select(Student)
        .options(selectinload(Student.exam_registrations))
        .where(Student.id == student_id)
    )
    return result.scalar_one_or_none()

async def get_student_with_exams(db: AsyncSession, student_id: int):
    result = await db.execute(
        select(Student)
        .options(
            selectinload(Student.exams).selectinload(Exam.exam_type),
            selectinload(Student.exams).selectinload(Exam.created_by),
            selectinload(Student.exam_registrations)
        )
        .where(Student.id == student_id)
    )
    return result.scalar_one_or_none()

async def get_all_students_with_exams(db: AsyncSession):
    result = await db.execute(
        select(Student)
        .options(
            selectinload(Student.exams).selectinload(Exam.exam_type),
            selectinload(Student.exams).selectinload(Exam.created_by)
        )
        .order_by(Student.id)
    )
    return result.scalars().all()

async def get_student_by_token(db: AsyncSession, access_token: str):
    """Получение студента по токену доступа с загрузкой экзаменов"""
    result = await db.execute(
        select(Student)
        .options(selectinload(Student.exams).selectinload(Exam.exam_type))
        .where(Student.access_token == access_token)
    )
    return result.scalar_one_or_none()

async def update_student(db: AsyncSession, student_id: int, student_update: StudentUpdate):
    """Обновление данных студента"""
    result = await db.execute(select(Student).where(Student.id == student_id))
    db_student = result.scalar_one_or_none()

    if db_student is None:
        return None

    update_data = student_update.dict(exclude_unset=True)

    # Если нужно регенерировать токен
    if update_data.pop('regenerate_access_token', False):
        db_student.access_token = generate_access_token()

    for field, value in update_data.items():
        setattr(db_student, field, value)

    await db.commit()
    await db.refresh(db_student)
    return db_student

async def delete_student(db: AsyncSession, student_id: int):
    """Удаление студента и всех связанных записей"""
    from models import Exam, ExamRegistration, group_student_association
    
    result = await db.execute(select(Student).where(Student.id == student_id))
    db_student = result.scalar_one_or_none()
    
    if db_student is None:
        return False
    
    # Удаляем связанные экзамены
    await db.execute(
        Exam.__table__.delete().where(Exam.id_student == student_id)
    )
    
    # Удаляем связанные записи на экзамен (telegram)
    await db.execute(
        ExamRegistration.__table__.delete().where(ExamRegistration.student_id == student_id)
    )
    
    # Удаляем связи с группами
    await db.execute(
        group_student_association.delete().where(
            group_student_association.c.student_id == student_id
        )
    )
    
    # Удаляем самого студента
    await db.delete(db_student)
    await db.commit()
    return True

# ==================== EXAM CRUD ====================

async def create_exam(db: AsyncSession, exam: ExamCreate, created_by_id: int = None):
    # Проверяем, что тип экзамена существует
    result = await db.execute(
        select(ExamType).where(ExamType.id == exam.exam_type_id)
    )
    exam_type = result.scalar_one_or_none()
    if not exam_type:
        raise ValueError("Тип экзамена не найден")

    # Проверяем, что студент существует
    student_result = await db.execute(select(Student).where(Student.id == exam.id_student))
    student = student_result.scalar_one_or_none()
    if not student:
        raise ValueError("Студент не найден")

    # Сбрасываем статус контакта с родителями при добавлении нового экзамена
    # Объект уже в сессии, поэтому изменения сохранятся автоматически
    student.parent_contact_status = None

    exam_data = exam.dict()
    exam_data['created_by_id'] = created_by_id
    db_exam = Exam(**exam_data)
    db.add(db_exam)
    await db.commit()
    await db.refresh(db_exam)
    # Обновляем студента, чтобы изменения статуса сохранились
    await db.refresh(student)
    return db_exam

async def get_exams(db: AsyncSession, skip: int = 0, limit: int = 100):
    result = await db.execute(
        select(Exam)
        .options(selectinload(Exam.exam_type), selectinload(Exam.created_by))
        .offset(skip)
        .limit(limit)
    )
    return result.scalars().all()

async def get_exam(db: AsyncSession, exam_id: int):
    result = await db.execute(
        select(Exam)
        .options(selectinload(Exam.exam_type), selectinload(Exam.created_by))
        .where(Exam.id == exam_id)
    )
    return result.scalar_one_or_none()

async def get_exams_with_students(db: AsyncSession, skip: int = 0, limit: int = 100):
    result = await db.execute(
        select(Exam)
        .options(selectinload(Exam.exam_type), selectinload(Exam.student), selectinload(Exam.created_by))
        .join(Student)
        .offset(skip)
        .limit(limit)
    )
    return result.scalars().all()

async def get_exams_by_student(db: AsyncSession, student_id: int):
    result = await db.execute(
        select(Exam).where(Exam.id_student == student_id)
    )
    return result.scalars().all()

async def update_exam(db: AsyncSession, exam_id: int, exam_update: ExamUpdate):
    result = await db.execute(
        select(Exam)
        .options(selectinload(Exam.exam_type), selectinload(Exam.created_by))
        .where(Exam.id == exam_id)
    )
    db_exam = result.scalar_one_or_none()

    if db_exam is None:
        return None

    update_data = exam_update.dict(exclude_unset=True)

    # Если поменяли exam_type_id — проверяем, что тип существует
    if "exam_type_id" in update_data:
        type_result = await db.execute(
            select(ExamType).where(ExamType.id == update_data["exam_type_id"])
        )
        exam_type = type_result.scalar_one_or_none()
        if not exam_type:
            raise ValueError("Тип экзамена не найден")

    for field, value in update_data.items():
        setattr(db_exam, field, value)

    await db.commit()
    await db.refresh(db_exam)
    return db_exam

# ==================== EXAM TYPE CRUD ====================

async def get_exam_types(db: AsyncSession, group_id: Optional[int] = None):
    query = select(ExamType)
    if group_id is not None:
        query = query.where(ExamType.group_id == group_id)
    result = await db.execute(query)
    return result.scalars().all()


async def create_exam_type(db: AsyncSession, name: str, group_id: int, completed_tasks: Optional[List[int]] = None):
    # Проверяем, что группа существует
    group_result = await db.execute(select(StudyGroup).where(StudyGroup.id == group_id))
    group = group_result.scalar_one_or_none()
    if not group:
        raise ValueError("Группа не найдена")
    
    # Проверяем, нет ли уже экзамена с таким названием в этой группе
    existing = await db.execute(
        select(ExamType).where(
            ExamType.name == name,
            ExamType.group_id == group_id
        )
    )
    exam_type = existing.scalar_one_or_none()
    if exam_type:
        # Если тип экзамена уже существует, обновляем completed_tasks
        if completed_tasks is not None:
            exam_type.completed_tasks = completed_tasks
            await db.commit()
            await db.refresh(exam_type)
        return exam_type

    # Логируем перед созданием
    print(f"CRUD: Creating exam type with completed_tasks={completed_tasks}, type={type(completed_tasks)}")
    
    # Создаем объект ExamType
    # Явно устанавливаем completed_tasks, чтобы убедиться, что оно сохраняется
    exam_type = ExamType(
        name=name, 
        group_id=group_id
    )
    
    # Явно устанавливаем completed_tasks после создания объекта
    if completed_tasks is not None:
        exam_type.completed_tasks = completed_tasks
        print(f"CRUD: Set completed_tasks to {exam_type.completed_tasks}")
    
    db.add(exam_type)
    await db.flush()  # Flush перед commit, чтобы проверить состояние
    print(f"CRUD: After flush - completed_tasks={exam_type.completed_tasks}, type={type(exam_type.completed_tasks)}")
    await db.commit()
    await db.refresh(exam_type)
    print(f"CRUD: After refresh - completed_tasks={exam_type.completed_tasks}, type={type(exam_type.completed_tasks)}")
    
    # Проверяем, что данные действительно сохранились
    # Читаем из БД заново для проверки
    verify_result = await db.execute(select(ExamType).where(ExamType.id == exam_type.id))
    verify_exam_type = verify_result.scalar_one_or_none()
    if verify_exam_type:
        print(f"CRUD: Verified from DB - completed_tasks={verify_exam_type.completed_tasks}, type={type(verify_exam_type.completed_tasks)}")
    
    return exam_type

async def delete_exam(db: AsyncSession, exam_id: int):
    result = await db.execute(select(Exam).where(Exam.id == exam_id))
    db_exam = result.scalar_one_or_none()
    
    if db_exam is None:
        return False
    
    await db.delete(db_exam)
    await db.commit()
    return True

async def delete_exam_type(db: AsyncSession, exam_type_id: int):
    """Удаление типа экзамена. Сначала проверяем, есть ли экзамены с этим типом."""
    # Проверяем, есть ли экзамены с этим типом
    exams_result = await db.execute(
        select(Exam).where(Exam.exam_type_id == exam_type_id)
    )
    exams = exams_result.scalars().all()
    
    if exams:
        # Если есть экзамены, сначала удаляем их
        for exam in exams:
            await db.delete(exam)
    
    # Удаляем сам тип экзамена
    exam_type_result = await db.execute(
        select(ExamType).where(ExamType.id == exam_type_id)
    )
    db_exam_type = exam_type_result.scalar_one_or_none()
    
    if db_exam_type is None:
        return False
    
    await db.delete(db_exam_type)
    await db.commit()
    return True

# ==================== GROUP CRUD ====================

async def create_group(db: AsyncSession, group: GroupCreate):
    """Создание новой группы"""
    try:
        # Используем model_dump для Pydantic v2 или dict для v1
        group_data = group.model_dump() if hasattr(group, 'model_dump') else group.dict()
        
        # Убеждаемся, что schedule правильно обрабатывается как JSON
        if 'schedule' in group_data and group_data['schedule'] is not None:
            # schedule уже должен быть словарем, SQLAlchemy JSON обработает его автоматически
            pass
        
        print(f"Creating group with data: {group_data}")  # Отладочный вывод
        
        db_group = StudyGroup(**group_data)
        db.add(db_group)
        await db.flush()  # Flush перед commit для проверки, но не commit здесь
        # НЕ делаем commit здесь - пусть вызывающий код управляет транзакцией
        await db.refresh(db_group)
        return db_group
    except Exception as e:
        await db.rollback()
        print(f"Error creating group: {e}")
        print(f"Error type: {type(e)}")
        import traceback
        traceback.print_exc()
        print(f"Group data: {group_data if 'group_data' in locals() else 'N/A'}")
        raise

async def get_groups_with_students(db: AsyncSession):
    """Получение всех групп со студентами и учителями"""
    result = await db.execute(
        select(StudyGroup)
        .options(selectinload(StudyGroup.students), selectinload(StudyGroup.teacher))
    )
    groups = result.unique().scalars().all()
    return groups

async def get_group(db: AsyncSession, group_id: int):
    """Получение одной группы со студентами и учителем"""
    result = await db.execute(
        select(StudyGroup)
        .options(selectinload(StudyGroup.students), selectinload(StudyGroup.teacher))
        .where(StudyGroup.id == group_id)
    )
    return result.scalar_one_or_none()

async def update_group(db: AsyncSession, group_id: int, group_update: GroupUpdate):
    """Обновление информации о группе (название, школа, предмет, расписание и т.д.)"""
    result = await db.execute(
        select(StudyGroup)
        .options(selectinload(StudyGroup.students), selectinload(StudyGroup.teacher))
        .where(StudyGroup.id == group_id)
    )
    db_group = result.scalar_one_or_none()
    
    if db_group is None:
        return None
    
    update_data = group_update.dict(exclude_unset=True)
    for field, value in update_data.items():
        setattr(db_group, field, value)
    
    await db.commit()
    
    # Перезагружаем группу со всеми связями
    result = await db.execute(
        select(StudyGroup)
        .options(selectinload(StudyGroup.students), selectinload(StudyGroup.teacher))
        .where(StudyGroup.id == group_id)
    )
    return result.scalar_one_or_none()

async def update_group_students(db: AsyncSession, group_id: int, student_ids: List[int]):
    """Обновление состава студентов в группе"""
    result = await db.execute(
        select(StudyGroup)
        .options(selectinload(StudyGroup.students), selectinload(StudyGroup.teacher))
        .where(StudyGroup.id == group_id)
    )
    group = result.scalar_one_or_none()
    if not group:
        return None

    # Получаем студентов по ID
    if student_ids:
        students_res = await db.execute(select(Student).where(Student.id.in_(student_ids)))
        new_students = students_res.scalars().all()
    else:
        new_students = []

    group.students = new_students
    await db.commit()
    await db.refresh(group)
    # Перезагружаем с учителем
    result = await db.execute(
        select(StudyGroup)
        .options(selectinload(StudyGroup.students), selectinload(StudyGroup.teacher))
        .where(StudyGroup.id == group_id)
    )
    return result.scalar_one_or_none()

async def delete_group(db: AsyncSession, group_id: int):
    """Удаление группы"""
    result = await db.execute(select(StudyGroup).where(StudyGroup.id == group_id))
    db_group = result.scalar_one_or_none()

    if db_group is None:
        return False

    await db.delete(db_group)
    await db.commit()
    return True


# ==================== SUBJECT CRUD ====================

async def get_subjects(db: AsyncSession, only_active: bool = False):
    """Получение всех предметов"""
    query = select(Subject).order_by(Subject.exam_type, Subject.name)
    if only_active:
        query = query.where(Subject.is_active == True)
    result = await db.execute(query)
    return result.scalars().all()


async def get_subject(db: AsyncSession, subject_id: int):
    """Получение предмета по ID"""
    result = await db.execute(select(Subject).where(Subject.id == subject_id))
    return result.scalar_one_or_none()


async def get_subject_by_code(db: AsyncSession, code: str):
    """Получение предмета по коду"""
    result = await db.execute(select(Subject).where(Subject.code == code))
    return result.scalar_one_or_none()


async def create_subject(db: AsyncSession, subject: SubjectCreate):
    """Создание нового предмета"""
    # Проверяем, что предмет с таким кодом не существует
    existing = await get_subject_by_code(db, subject.code)
    if existing:
        raise ValueError(f"Предмет с кодом '{subject.code}' уже существует")

    # Конвертируем topics из list[TopicItem] в list[dict]
    topics_data = None
    if subject.topics:
        topics_data = [{"task_number": t.task_number, "topic": t.topic} for t in subject.topics]

    # Конвертируем grade_scale из list[GradeScaleItem] в list[dict]
    grade_scale_data = None
    if subject.grade_scale:
        grade_scale_data = [{"grade": g.grade, "min": g.min, "max": g.max} for g in subject.grade_scale]

    db_subject = Subject(
        code=subject.code,
        name=subject.name,
        exam_type=subject.exam_type,
        tasks_count=subject.tasks_count,
        max_per_task=subject.max_per_task,
        primary_to_secondary_scale=subject.primary_to_secondary_scale,
        grade_scale=grade_scale_data,
        special_config=subject.special_config,
        topics=topics_data,
        is_active=subject.is_active
    )

    db.add(db_subject)
    await db.commit()
    await db.refresh(db_subject)
    return db_subject


async def update_subject(db: AsyncSession, subject_id: int, subject_update: SubjectUpdate):
    """Обновление предмета"""
    result = await db.execute(select(Subject).where(Subject.id == subject_id))
    db_subject = result.scalar_one_or_none()

    if db_subject is None:
        return None

    update_data = subject_update.dict(exclude_unset=True)

    # Если обновляется код, проверяем уникальность
    if "code" in update_data and update_data["code"] != db_subject.code:
        existing = await get_subject_by_code(db, update_data["code"])
        if existing:
            raise ValueError(f"Предмет с кодом '{update_data['code']}' уже существует")

    # Конвертируем topics если есть
    if "topics" in update_data and update_data["topics"] is not None:
        topics_data = [{"task_number": t.task_number, "topic": t.topic} for t in subject_update.topics]
        update_data["topics"] = topics_data

    # Конвертируем grade_scale если есть
    if "grade_scale" in update_data and update_data["grade_scale"] is not None:
        grade_scale_data = [{"grade": g.grade, "min": g.min, "max": g.max} for g in subject_update.grade_scale]
        update_data["grade_scale"] = grade_scale_data

    for field, value in update_data.items():
        setattr(db_subject, field, value)

    await db.commit()
    await db.refresh(db_subject)
    return db_subject


async def delete_subject(db: AsyncSession, subject_id: int):
    """Удаление предмета"""
    result = await db.execute(select(Subject).where(Subject.id == subject_id))
    db_subject = result.scalar_one_or_none()

    if db_subject is None:
        return False

    await db.delete(db_subject)
    await db.commit()
    return True


# ==================== WORK SESSION CRUD ====================

async def start_work_session(db: AsyncSession, employee_id: int):
    """Начать рабочую сессию"""
    # Проверяем, нет ли уже активной сессии
    active_session = await get_active_work_session(db, employee_id)
    if active_session:
        raise ValueError("У сотрудника уже есть активная рабочая сессия")

    db_session = WorkSession(
        employee_id=employee_id,
        start_time=datetime.utcnow()
    )
    db.add(db_session)
    await db.commit()
    await db.refresh(db_session)
    return db_session


async def end_work_session(db: AsyncSession, session_id: int):
    """Завершить рабочую сессию"""
    result = await db.execute(select(WorkSession).where(WorkSession.id == session_id))
    db_session = result.scalar_one_or_none()

    if db_session is None:
        return None

    if db_session.end_time is not None:
        raise ValueError("Эта сессия уже завершена")

    db_session.end_time = datetime.utcnow()
    # Вычисляем продолжительность в минутах
    duration = (db_session.end_time - db_session.start_time).total_seconds() / 60
    db_session.duration_minutes = int(duration)

    await db.commit()
    await db.refresh(db_session)
    return db_session


async def get_active_work_session(db: AsyncSession, employee_id: int):
    """Получить активную рабочую сессию сотрудника"""
    result = await db.execute(
        select(WorkSession)
        .where(WorkSession.employee_id == employee_id, WorkSession.end_time == None)
    )
    return result.scalar_one_or_none()


async def get_work_sessions(db: AsyncSession, employee_id: Optional[int] = None):
    """Получить рабочие сессии"""
    query = select(WorkSession).options(selectinload(WorkSession.employee))

    if employee_id is not None:
        query = query.where(WorkSession.employee_id == employee_id)

    query = query.order_by(WorkSession.start_time.desc())

    result = await db.execute(query)
    return result.scalars().all()


# ==================== TASK CRUD ====================

async def create_task(db: AsyncSession, task_data: dict, created_by_id: int):
    """Создать задачу"""
    # Парсим deadline если есть
    deadline = None
    if task_data.get("deadline"):
        try:
            deadline = datetime.fromisoformat(task_data["deadline"].replace("Z", "+00:00"))
        except:
            pass

    # Сериализуем linked_students в список dict
    linked_students = task_data.get("linked_students")
    if linked_students and not isinstance(linked_students[0], dict):
        linked_students = [s.dict() if hasattr(s, 'dict') else s for s in linked_students]

    db_task = Task(
        title=task_data["title"],
        description=task_data.get("description"),
        deadline=deadline,
        deadline_type=task_data.get("deadline_type"),
        linked_students=linked_students or [],
        created_by_id=created_by_id,
        assigned_to_id=task_data["assigned_to_id"]
    )
    db.add(db_task)
    await db.commit()
    await db.refresh(db_task)
    return db_task


async def get_tasks(db: AsyncSession, employee_id: Optional[int] = None, created_by_id: Optional[int] = None, report_date: Optional[str] = None):
    """Получить задачи.
    Если передан report_date (YYYY-MM-DD), возвращает:
    - все незавершённые задачи
    - завершённые задачи, у которых completed_at приходится на эту дату
    """
    from sqlalchemy import or_, func, cast
    import sqlalchemy as sa

    query = select(Task).options(
        selectinload(Task.created_by),
        selectinload(Task.assigned_to)
    )

    if employee_id is not None:
        query = query.where(Task.assigned_to_id == employee_id)

    if created_by_id is not None:
        query = query.where(Task.created_by_id == created_by_id)

    if report_date is not None:
        # Показываем незавершённые + завершённые в указанный день
        query = query.where(
            or_(
                Task.status.notin_(['completed']),
                func.date(Task.completed_at) == report_date
            )
        )

    query = query.order_by(Task.created_at.desc())

    result = await db.execute(query)
    return result.scalars().all()


async def get_task(db: AsyncSession, task_id: int):
    """Получить задачу по ID"""
    result = await db.execute(
        select(Task)
        .options(selectinload(Task.created_by), selectinload(Task.assigned_to))
        .where(Task.id == task_id)
    )
    return result.scalar_one_or_none()


async def update_task(db: AsyncSession, task_id: int, task_update: dict):
    """Обновить задачу"""
    result = await db.execute(select(Task).where(Task.id == task_id))
    db_task = result.scalar_one_or_none()

    if db_task is None:
        return None

    # Обновляем поля
    if "title" in task_update and task_update["title"] is not None:
        db_task.title = task_update["title"]

    if "description" in task_update and task_update["description"] is not None:
        db_task.description = task_update["description"]

    if "deadline" in task_update and task_update["deadline"] is not None:
        try:
            db_task.deadline = datetime.fromisoformat(task_update["deadline"].replace("Z", "+00:00"))
        except:
            pass

    if "status" in task_update and task_update["status"] is not None:
        new_status = task_update["status"]
        if new_status == "completed":
            # Ставим completed_at, если ещё не установлен
            if db_task.completed_at is None:
                db_task.completed_at = datetime.utcnow()
        elif new_status == "postponed":
            db_task.completed_at = None
            # Автоматически переносим дедлайн на завтра
            tomorrow = (datetime.utcnow() + timedelta(days=1)).replace(hour=18, minute=0, second=0, microsecond=0)
            db_task.deadline = tomorrow
            db_task.deadline_type = "tomorrow"
        elif new_status != "completed":
            db_task.completed_at = None
        db_task.status = new_status

    if "assigned_to_id" in task_update and task_update["assigned_to_id"] is not None:
        db_task.assigned_to_id = task_update["assigned_to_id"]

    db_task.updated_at = datetime.utcnow()

    await db.commit()
    await db.refresh(db_task)
    return db_task


# ==================== REPORT CRUD ====================

async def start_report(db: AsyncSession, employee_id: int):
    """Начать рабочий день — создаёт пустой отчёт или возвращает уже открытый"""
    today = datetime.utcnow().date()
    # Ищем уже открытый отчёт (без work_end_time) за сегодня
    result = await db.execute(
        select(Report).where(
            Report.employee_id == employee_id,
            Report.work_end_time == None  # noqa: E711
        ).order_by(Report.created_at.desc())
    )
    existing = result.scalar_one_or_none()
    if existing:
        return existing

    db_report = Report(
        employee_id=employee_id,
        report_date=today,
        work_start_time=datetime.utcnow(),
        leads={},
        money={},
        content='',
    )
    db.add(db_report)
    await db.commit()
    await db.refresh(db_report)
    return db_report


async def create_report(db: AsyncSession, report_data: dict, employee_id: int):
    """Создать отчет"""
    # Парсим дату
    report_date = datetime.fromisoformat(report_data["report_date"])

    # Подготавливаем данные о лидах и деньгах
    leads_data = report_data.get("leads")
    if leads_data:
        leads_dict = leads_data if isinstance(leads_data, dict) else leads_data.dict()
    else:
        leads_dict = None

    money_data = report_data.get("money")
    if money_data:
        money_dict = money_data if isinstance(money_data, dict) else money_data.dict()
    else:
        money_dict = None

    # Парсим время начала/конца рабочего дня
    work_start_time = None
    if report_data.get("work_start_time"):
        try:
            work_start_time = datetime.fromisoformat(
                report_data["work_start_time"].replace("Z", "+00:00")
            )
        except Exception:
            pass

    work_end_time = None
    if report_data.get("work_end_time"):
        try:
            work_end_time = datetime.fromisoformat(
                report_data["work_end_time"].replace("Z", "+00:00")
            )
        except Exception:
            pass

    db_report = Report(
        employee_id=employee_id,
        report_date=report_date,
        leads=leads_dict,
        trial_scheduled=report_data.get("trial_scheduled", 0),
        trial_attended=report_data.get("trial_attended", 0),
        notified_tomorrow=report_data.get("notified_tomorrow", ""),
        cancellations=report_data.get("cancellations", ""),
        churn=report_data.get("churn", ""),
        money=money_dict,
        water=report_data.get("water", ""),
        supplies_needed=report_data.get("supplies_needed", ""),
        comments=report_data.get("comments", ""),
        work_start_time=work_start_time,
        work_end_time=work_end_time,
        content=""  # Для совместимости со старой версией
    )
    db.add(db_report)
    await db.commit()
    await db.refresh(db_report)
    return db_report


async def get_reports(db: AsyncSession, employee_id: Optional[int] = None):
    """Получить отчеты"""
    query = select(Report).options(selectinload(Report.employee))

    if employee_id is not None:
        query = query.where(Report.employee_id == employee_id)

    query = query.order_by(Report.created_at.desc())

    result = await db.execute(query)
    return result.scalars().all()


async def update_report(db: AsyncSession, report_id: int, data: dict):
    """Обновить отчет"""
    result = await db.execute(select(Report).where(Report.id == report_id))
    db_report = result.scalar_one_or_none()
    if not db_report:
        return None

    if data.get("report_date"):
        db_report.report_date = datetime.fromisoformat(data["report_date"])

    if "leads" in data and data["leads"] is not None:
        db_report.leads = data["leads"] if isinstance(data["leads"], dict) else data["leads"].dict()

    if "money" in data and data["money"] is not None:
        db_report.money = data["money"] if isinstance(data["money"], dict) else data["money"].dict()

    for field in ["trial_scheduled", "trial_attended", "notified_tomorrow",
                  "cancellations", "churn", "water", "supplies_needed", "comments"]:
        if field in data and data[field] is not None:
            setattr(db_report, field, data[field])

    for time_field in ["work_start_time", "work_end_time"]:
        if time_field in data and data[time_field] is not None:
            try:
                setattr(db_report, time_field,
                        datetime.fromisoformat(data[time_field].replace("Z", "+00:00")))
            except Exception:
                pass

    await db.commit()
    await db.refresh(db_report)
    return db_report


async def delete_report(db: AsyncSession, report_id: int) -> bool:
    """Удалить отчет"""
    result = await db.execute(select(Report).where(Report.id == report_id))
    db_report = result.scalar_one_or_none()
    if not db_report:
        return False
    await db.delete(db_report)
    await db.commit()
    return True


# ==================== LESSON CRUD ====================

async def create_lesson(db: AsyncSession, lesson_data: dict, created_by_id: Optional[int] = None):
    """Создать урок"""
    lesson_date = datetime.fromisoformat(lesson_data["lesson_date"].replace("Z", "+00:00"))

    db_lesson = Lesson(
        group_id=lesson_data["group_id"],
        lesson_date=lesson_date,
        duration_minutes=lesson_data.get("duration_minutes", 90),
        topic=lesson_data.get("topic"),
        homework=lesson_data.get("homework"),
        grading_mode=lesson_data.get("grading_mode", "numeric"),
        total_tasks=lesson_data.get("total_tasks"),
        homework_total_tasks=lesson_data.get("homework_total_tasks"),
        auto_generated=lesson_data.get("auto_generated", False),
        created_by_id=created_by_id
    )
    db.add(db_lesson)
    await db.commit()
    await db.refresh(db_lesson)
    return db_lesson


async def get_lessons_by_teacher(db: AsyncSession, teacher_id: int, start_date: Optional[datetime] = None, end_date: Optional[datetime] = None):
    """Получить уроки учителя за период"""
    query = select(Lesson).join(StudyGroup).where(
        StudyGroup.teacher_id == teacher_id,
        Lesson.is_cancelled == False
    ).options(
        selectinload(Lesson.group),
        selectinload(Lesson.attendances),
        selectinload(Lesson.completed_by)
    ).order_by(Lesson.lesson_date)

    if start_date:
        query = query.where(Lesson.lesson_date >= start_date)
    if end_date:
        query = query.where(Lesson.lesson_date <= end_date)

    result = await db.execute(query)
    return result.scalars().all()


async def get_lessons_by_group(db: AsyncSession, group_id: int, start_date: Optional[datetime] = None, end_date: Optional[datetime] = None):
    """Получить уроки группы за период"""
    query = select(Lesson).where(
        Lesson.group_id == group_id
    ).options(
        selectinload(Lesson.group),
        selectinload(Lesson.attendances),
        selectinload(Lesson.completed_by)
    ).order_by(Lesson.lesson_date)

    if start_date:
        query = query.where(Lesson.lesson_date >= start_date)
    if end_date:
        query = query.where(Lesson.lesson_date <= end_date)

    result = await db.execute(query)
    return result.scalars().all()


async def get_lessons_by_school(db: AsyncSession, school: str, start_date: Optional[datetime] = None, end_date: Optional[datetime] = None):
    """Получить уроки школы за период (для администраторов школы)"""
    query = select(Lesson).join(StudyGroup).where(
        StudyGroup.school == school,
        Lesson.is_cancelled == False
    ).options(
        selectinload(Lesson.group),
        selectinload(Lesson.attendances),
        selectinload(Lesson.completed_by)
    ).order_by(Lesson.lesson_date)

    if start_date:
        query = query.where(Lesson.lesson_date >= start_date)
    if end_date:
        query = query.where(Lesson.lesson_date <= end_date)

    result = await db.execute(query)
    return result.scalars().all()


async def get_all_lessons(db: AsyncSession, start_date: Optional[datetime] = None, end_date: Optional[datetime] = None):
    """Получить все уроки (для владельца)"""
    query = select(Lesson).where(
        Lesson.is_cancelled == False
    ).options(
        selectinload(Lesson.group),
        selectinload(Lesson.attendances),
        selectinload(Lesson.completed_by)
    ).order_by(Lesson.lesson_date)

    if start_date:
        query = query.where(Lesson.lesson_date >= start_date)
    if end_date:
        query = query.where(Lesson.lesson_date <= end_date)

    result = await db.execute(query)
    return result.scalars().all()


async def get_lesson(db: AsyncSession, lesson_id: int):
    """Получить урок с полными данными"""
    result = await db.execute(
        select(Lesson)
        .options(
            selectinload(Lesson.group).selectinload(StudyGroup.students),
            selectinload(Lesson.attendances).selectinload(LessonAttendance.student),
            selectinload(Lesson.completed_by)
        )
        .where(Lesson.id == lesson_id)
    )
    return result.scalar_one_or_none()


async def update_lesson(db: AsyncSession, lesson_id: int, lesson_data: dict):
    """Обновить урок"""
    result = await db.execute(select(Lesson).where(Lesson.id == lesson_id))
    db_lesson = result.scalar_one_or_none()
    if not db_lesson:
        return None

    if "lesson_date" in lesson_data:
        db_lesson.lesson_date = datetime.fromisoformat(lesson_data["lesson_date"].replace("Z", "+00:00"))
        db_lesson.auto_generated = False  # При ручном изменении даты снимаем флаг автогенерации

    if "topic" in lesson_data:
        db_lesson.topic = lesson_data["topic"]

    if "homework" in lesson_data:
        db_lesson.homework = lesson_data["homework"]

    if "duration_minutes" in lesson_data:
        db_lesson.duration_minutes = lesson_data["duration_minutes"]

    if "grading_mode" in lesson_data:
        db_lesson.grading_mode = lesson_data["grading_mode"]

    if "total_tasks" in lesson_data:
        db_lesson.total_tasks = lesson_data["total_tasks"]

    if "homework_total_tasks" in lesson_data:
        db_lesson.homework_total_tasks = lesson_data["homework_total_tasks"]

    db_lesson.updated_at = datetime.now()

    await db.commit()
    await db.refresh(db_lesson)
    return db_lesson


async def cancel_lesson(db: AsyncSession, lesson_id: int, reason: Optional[str] = None):
    """Отменить урок (мягкое удаление)"""
    result = await db.execute(select(Lesson).where(Lesson.id == lesson_id))
    db_lesson = result.scalar_one_or_none()
    if not db_lesson:
        return None

    db_lesson.is_cancelled = True
    db_lesson.cancellation_reason = reason
    db_lesson.updated_at = datetime.now()

    await db.commit()
    await db.refresh(db_lesson)
    return db_lesson


async def delete_lesson(db: AsyncSession, lesson_id: int) -> bool:
    """Удалить урок (жесткое удаление)"""
    result = await db.execute(select(Lesson).where(Lesson.id == lesson_id))
    db_lesson = result.scalar_one_or_none()
    if not db_lesson:
        return False

    await db.delete(db_lesson)
    await db.commit()
    return True


async def fill_lesson(db: AsyncSession, lesson_id: int, attendances_data: list, completed_by_id: Optional[int] = None):
    """Заполнить посещаемость урока"""
    # Получаем урок
    result = await db.execute(select(Lesson).where(Lesson.id == lesson_id))
    db_lesson = result.scalar_one_or_none()
    if not db_lesson:
        return None

    # Удаляем старые записи посещаемости
    await db.execute(
        select(LessonAttendance).where(LessonAttendance.lesson_id == lesson_id)
    )
    result = await db.execute(
        select(LessonAttendance).where(LessonAttendance.lesson_id == lesson_id)
    )
    existing_attendances = result.scalars().all()
    for att in existing_attendances:
        await db.delete(att)

    # Создаем новые записи посещаемости
    for att_data in attendances_data:
        db_attendance = LessonAttendance(
            lesson_id=lesson_id,
            student_id=att_data["student_id"],
            attendance_status=att_data.get("attendance_status", "present"),
            grade_value=att_data.get("grade_value"),
            homework_grade_value=att_data.get("homework_grade_value"),
            comment=att_data.get("comment")
        )
        db.add(db_attendance)

    # Отмечаем урок как заполненный
    db_lesson.is_completed = True
    db_lesson.completed_at = datetime.now()
    db_lesson.completed_by_id = completed_by_id
    db_lesson.updated_at = datetime.now()

    await db.commit()
    await db.refresh(db_lesson)

    # Загружаем урок с посещаемостью
    result = await db.execute(
        select(Lesson)
        .options(selectinload(Lesson.attendances))
        .where(Lesson.id == lesson_id)
    )
    return result.scalar_one_or_none()


# ==================== LESSON AUTO-GENERATION ====================

# Маппинг дней недели
WEEKDAY_MAP = {
    "monday": 0,
    "tuesday": 1,
    "wednesday": 2,
    "thursday": 3,
    "friday": 4,
    "saturday": 5,
    "sunday": 6
}


def parse_schedule_time(time_str: str):
    """Парсит строку времени типа '10:00-12:00' и возвращает (start_hour, start_minute, duration_minutes)"""
    if not time_str or '-' not in time_str:
        return None, None, 90  # Дефолт 90 минут

    try:
        start_str, end_str = time_str.split('-')
        start_parts = start_str.strip().split(':')
        end_parts = end_str.strip().split(':')

        start_hour = int(start_parts[0])
        start_minute = int(start_parts[1]) if len(start_parts) > 1 else 0

        end_hour = int(end_parts[0])
        end_minute = int(end_parts[1]) if len(end_parts) > 1 else 0

        # Вычисляем длительность в минутах
        duration_minutes = (end_hour * 60 + end_minute) - (start_hour * 60 + start_minute)

        return start_hour, start_minute, duration_minutes
    except Exception:
        return None, None, 90


async def generate_lessons_for_group(db: AsyncSession, group_id: int, start_date: datetime, end_date: datetime):
    """Генерирует уроки для группы на заданный период на основе расписания"""
    # Получаем группу с расписанием
    result = await db.execute(
        select(StudyGroup).where(StudyGroup.id == group_id)
    )
    group = result.scalar_one_or_none()

    if not group or not group.schedule:
        return []

    # Проверяем существующие уроки, чтобы не создавать дубликаты
    result = await db.execute(
        select(Lesson).where(
            Lesson.group_id == group_id,
            Lesson.lesson_date >= start_date,
            Lesson.lesson_date <= end_date
        )
    )
    existing_lessons = result.scalars().all()
    existing_dates = {lesson.lesson_date.date() for lesson in existing_lessons}

    created_lessons = []
    current_date = start_date.date()
    end_date_only = end_date.date()

    # Итерируемся по дням в диапазоне
    while current_date <= end_date_only:
        weekday_name = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"][current_date.weekday()]

        # Проверяем, есть ли урок в этот день недели
        if weekday_name in group.schedule:
            time_str = group.schedule[weekday_name]
            start_hour, start_minute, duration = parse_schedule_time(time_str)

            if start_hour is not None:
                lesson_datetime = datetime.combine(current_date, datetime.min.time()).replace(
                    hour=start_hour,
                    minute=start_minute
                )

                # Проверяем, что нет урока в эту дату
                if current_date not in existing_dates:
                    db_lesson = Lesson(
                        group_id=group_id,
                        lesson_date=lesson_datetime,
                        duration_minutes=duration,
                        auto_generated=True
                    )
                    db.add(db_lesson)
                    created_lessons.append(db_lesson)
                    existing_dates.add(current_date)

        current_date += timedelta(days=1)

    await db.commit()
    return created_lessons


async def regenerate_lessons_for_updated_schedule(db: AsyncSession, group_id: int):
    """Регенерирует уроки при изменении расписания группы"""
    now = datetime.now()

    # Удаляем только будущие автосозданные незаполненные уроки
    result = await db.execute(
        select(Lesson).where(
            Lesson.group_id == group_id,
            Lesson.lesson_date > now,
            Lesson.auto_generated == True,
            Lesson.is_completed == False
        )
    )
    lessons_to_delete = result.scalars().all()

    for lesson in lessons_to_delete:
        await db.delete(lesson)

    await db.commit()

    # Генерируем новые уроки на 3 месяца вперед
    end_date = now + timedelta(days=90)
    return await generate_lessons_for_group(db, group_id, now, end_date)