from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload
from models import Student, Exam, StudyGroup, Employee
from schemas import StudentCreate, StudentUpdate, ExamCreate, ExamUpdate, GroupCreate, GroupUpdate
from typing import List, Optional

# ==================== STUDENT CRUD ====================

async def create_student(db: AsyncSession, student: StudentCreate):
    db_student = Student(**student.dict())
    db.add(db_student)
    await db.commit()
    await db.refresh(db_student)
    return db_student

async def get_students(db: AsyncSession, skip: int = 0, limit: int = 100):
    result = await db.execute(select(Student))
    return result.scalars().all()

async def get_student(db: AsyncSession, student_id: int):
    result = await db.execute(select(Student).where(Student.id == student_id))
    return result.scalar_one_or_none()

async def get_student_with_exams(db: AsyncSession, student_id: int):
    result = await db.execute(
        select(Student)
        .options(selectinload(Student.exams))
        .where(Student.id == student_id)
    )
    return result.scalar_one_or_none()

async def get_all_students_with_exams(db: AsyncSession):
    result = await db.execute(
        select(Student)
        .options(selectinload(Student.exams))
        .order_by(Student.id)
    )
    return result.scalars().all()

async def update_student(db: AsyncSession, student_id: int, student_update: StudentUpdate):
    """Обновление данных студента"""
    result = await db.execute(select(Student).where(Student.id == student_id))
    db_student = result.scalar_one_or_none()
    
    if db_student is None:
        return None
    
    update_data = student_update.dict(exclude_unset=True)
    for field, value in update_data.items():
        setattr(db_student, field, value)
    
    await db.commit()
    await db.refresh(db_student)
    return db_student

# ==================== EXAM CRUD ====================

async def create_exam(db: AsyncSession, exam: ExamCreate):
    db_exam = Exam(**exam.dict())
    db.add(db_exam)
    await db.commit()
    await db.refresh(db_exam)
    return db_exam

async def get_exams(db: AsyncSession, skip: int = 0, limit: int = 100):
    result = await db.execute(
        select(Exam).offset(skip).limit(limit)
    )
    return result.scalars().all()

async def get_exam(db: AsyncSession, exam_id: int):
    result = await db.execute(select(Exam).where(Exam.id == exam_id))
    return result.scalar_one_or_none()

async def get_exams_with_students(db: AsyncSession, skip: int = 0, limit: int = 100):
    result = await db.execute(
        select(Exam).join(Student).offset(skip).limit(limit)
    )
    return result.scalars().all()

async def get_exams_by_student(db: AsyncSession, student_id: int):
    result = await db.execute(
        select(Exam).where(Exam.id_student == student_id)
    )
    return result.scalars().all()

async def update_exam(db: AsyncSession, exam_id: int, exam_update: ExamUpdate):
    result = await db.execute(select(Exam).where(Exam.id == exam_id))
    db_exam = result.scalar_one_or_none()
    
    if db_exam is None:
        return None
    
    update_data = exam_update.dict(exclude_unset=True)
    for field, value in update_data.items():
        setattr(db_exam, field, value)
    
    await db.commit()
    await db.refresh(db_exam)
    return db_exam

async def delete_exam(db: AsyncSession, exam_id: int):
    result = await db.execute(select(Exam).where(Exam.id == exam_id))
    db_exam = result.scalar_one_or_none()
    
    if db_exam is None:
        return False
    
    await db.delete(db_exam)
    await db.commit()
    return True

# ==================== GROUP CRUD ====================

async def create_group(db: AsyncSession, group: GroupCreate):
    """Создание новой группы"""
    db_group = StudyGroup(**group.dict())
    db.add(db_group)
    await db.commit()
    await db.refresh(db_group)
    return db_group

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