from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload
from models import Student, Exam, StudyGroup, Employee, ExamType, Subject
from schemas import StudentCreate, StudentUpdate, ExamCreate, ExamUpdate, GroupCreate, GroupUpdate, SubjectCreate, SubjectUpdate
from typing import List, Optional
import json
import secrets

# ==================== HELPER FUNCTIONS ====================

def generate_access_token() -> str:
    """Генерирует уникальный токен для доступа к результатам студента"""
    return secrets.token_urlsafe(32)

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