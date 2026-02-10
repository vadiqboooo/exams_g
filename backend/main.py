from fastapi import FastAPI, Depends, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload
from typing import List, Optional
from collections import defaultdict
from datetime import datetime
import os

from database import get_db, create_tables
import crud
import schemas
from schemas import GroupStudentsUpdate, GroupUpdate
from models import Base, Student, Exam, StudyGroup, Employee, ExamRegistration, Probnik, ExamType, Subject, group_student_association, WorkSession, Task, Report, Lesson, LessonAttendance

from auth_routes import router as auth_router
from auth import get_current_user, require_owner, require_owner_or_school_admin
from telegram_routes import router as telegram_router


app = FastAPI(title="Student Exam System", version="1.0.0")

def utc_iso(dt) -> str:
    """Сериализует datetime в ISO-строку. Для naive datetime (без timezone) возвращает без суффикса Z."""
    if dt is None:
        return None
    # Если datetime имеет timezone info, добавляем Z для UTC
    if dt.tzinfo is not None and dt.utcoffset() is not None:
        return dt.isoformat() + "Z"
    # Для naive datetime возвращаем как есть (локальное время)
    return dt.isoformat()


def normalize_student_data(student):
    """Нормализует данные студента: преобразует пустые строки в None для user_id и class_num"""
    user_id = student.user_id
    if user_id == '' or user_id is None:
        user_id = None
    elif isinstance(user_id, str):
        try:
            user_id = int(user_id) if user_id.strip() else None
        except (ValueError, AttributeError):
            user_id = None
    
    class_num = student.class_num
    if class_num == '' or class_num is None:
        class_num = None
    elif isinstance(class_num, str):
        try:
            class_num = int(class_num) if class_num.strip() else None
        except (ValueError, AttributeError):
            class_num = None
    
    # Извлекаем уникальные школы из записей на экзамен
    schools = []
    if hasattr(student, 'exam_registrations') and student.exam_registrations:
        schools = list(set([
            reg.school for reg in student.exam_registrations 
            if reg.school and reg.school.strip()
        ]))
    
    return {
        'id': student.id,
        'fio': student.fio,
        'phone': student.phone,
        'user_id': user_id,
        'class_num': class_num,
        'admin_comment': student.admin_comment,
        'parent_contact_status': student.parent_contact_status,
        'schools': schools if schools else None,
        'access_token': student.access_token
    }

# CORS middleware должен быть добавлен ПЕРВЫМ, до всех остальных middleware и роутеров
# Получаем разрешенные источники из переменных окружения или используем значения по умолчанию
allowed_origins = os.getenv(
    "CORS_ORIGINS",
    "http://localhost:5173,http://127.0.0.1:5173,http://localhost:3000,http://127.0.0.1:3000,http://localhost:8000,http://127.0.0.1:8000,http://localhost,http://127.0.0.1"
).split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
)

os.makedirs("static", exist_ok=True)
app.mount("/static", StaticFiles(directory="static"), name="static")

app.include_router(auth_router)
app.include_router(telegram_router)

@app.on_event("startup")
async def startup_event():
    await create_tables()

# Обработчик OPTIONS для всех путей (для CORS preflight запросов)
@app.options("/{full_path:path}")
async def options_handler(full_path: str):
    return {"message": "OK"}

@app.get("/")
async def read_root():
    return FileResponse("static/index.html")

# Student endpoints
@app.post("/students/", response_model=schemas.StudentResponse)
async def create_student(
    student: schemas.StudentCreate, 
    db: AsyncSession = Depends(get_db)
):
    try:
        return await crud.create_student(db=db, student=student)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.get("/students/", response_model=List[schemas.StudentResponse])
async def read_students(
    skip: int = 0,
    limit: int = 100,
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(get_current_user)
):
    students = await crud.get_students(db=db, skip=skip, limit=limit)

    # Фильтрация для school_admin - показываем только студентов из групп своей школы
    if user.get("role") == "school_admin":
        school = user.get("school")
        if school:
            # Получаем группы этой школы
            result = await db.execute(
                select(StudyGroup.id).where(StudyGroup.school == school)
            )
            school_group_ids = set([row[0] for row in result.all()])

            # Фильтруем студентов - показываем только тех, кто есть хотя бы в одной группе этой школы
            filtered_students = []
            for student in students:
                # Загружаем группы студента
                student_result = await db.execute(
                    select(Student)
                    .options(selectinload(Student.groups))
                    .where(Student.id == student.id)
                )
                student_with_groups = student_result.scalar_one_or_none()
                if student_with_groups and student_with_groups.groups:
                    student_group_ids = set([g.id for g in student_with_groups.groups])
                    if student_group_ids & school_group_ids:  # Есть пересечение
                        filtered_students.append(student)

            students = filtered_students

    # Нормализуем данные перед валидацией - преобразуем пустые строки в None
    return [schemas.StudentResponse(**normalize_student_data(s)) for s in students]

@app.get("/students/{student_id}", response_model=schemas.StudentResponse)
async def read_student(student_id: int, db: AsyncSession = Depends(get_db)):
    student = await crud.get_student(db=db, student_id=student_id)
    if student is None:
        raise HTTPException(status_code=404, detail="Student not found")
    return schemas.StudentResponse(**normalize_student_data(student))

@app.put("/students/{student_id}", response_model=schemas.StudentResponse)
async def update_student(
    student_id: int,
    student_update: schemas.StudentUpdate,
    db: AsyncSession = Depends(get_db)
):
    student = await crud.update_student(db=db, student_id=student_id, student_update=student_update)
    if student is None:
        raise HTTPException(status_code=404, detail="Student not found")
    return student

@app.delete("/students/{student_id}")
async def delete_student(
    student_id: int,
    db: AsyncSession = Depends(get_db)
):
    success = await crud.delete_student(db=db, student_id=student_id)
    if not success:
        raise HTTPException(status_code=404, detail="Student not found")
    return {"message": "Student deleted successfully"}

@app.get("/students/{student_id}/exams", response_model=schemas.StudentWithExamsResponse)
async def read_student_with_exams(student_id: int, db: AsyncSession = Depends(get_db)):
    student = await crud.get_student_with_exams(db=db, student_id=student_id)
    if student is None:
        raise HTTPException(status_code=404, detail="Student not found")
    return student

@app.get("/students-with-exams/", response_model=List[schemas.StudentWithExamsResponse])
async def read_all_students_with_exams(db: AsyncSession = Depends(get_db)):
    try:
        students = await crud.get_all_students_with_exams(db=db)
        return students
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")

# Exam endpoints
@app.post("/exams/", response_model=schemas.ExamResponse)
async def create_exam(
    exam: schemas.ExamCreate,
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(get_current_user)
):
    student = await crud.get_student(db=db, student_id=exam.id_student)
    if student is None:
        raise HTTPException(status_code=404, detail="Student not found")

    # Получаем ID текущего пользователя (создателя)
    username = user.get("username") or user.get("sub")
    created_by_id = None
    if username:
        employee_query = await db.execute(
            select(Employee.id).where(Employee.username == username)
        )
        created_by_id = employee_query.scalar_one_or_none()

    try:
        created_exam = await crud.create_exam(db=db, exam=exam, created_by_id=created_by_id)
        # Перезагружаем с exam_type и created_by для получения полной информации
        result = await db.execute(
            select(Exam)
            .options(selectinload(Exam.exam_type), selectinload(Exam.created_by))
            .where(Exam.id == created_exam.id)
        )
        exam_with_type = result.scalar_one_or_none()
        return schemas.ExamResponse.from_orm_with_name(exam_with_type)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.get("/exams/", response_model=List[schemas.ExamResponse])
async def read_exams(
    skip: int = 0, 
    limit: int = 100, 
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(get_current_user)
):
 
    # OWNER/ADMIN — получает всё
    if user.get("role") in ["owner", "admin"]:
        exams = await crud.get_exams(db=db, skip=skip, limit=limit)
        return [schemas.ExamResponse.from_orm_with_name(exam) for exam in exams]
    
    # TEACHER — получаем ID учителя и список его групп
    username = user.get("username") or user.get("sub")
    if not username:
        # Если username отсутствует в токене, возвращаем пустой список
        return []
    
    teacher_query = await db.execute(
        select(Employee.id).where(Employee.username == username)
    )
    teacher_id = teacher_query.scalar_one_or_none()
    
    if not teacher_id:
        return []  # учитель не найден
    
    teacher_groups_query = await db.execute(
        select(StudyGroup.id).where(StudyGroup.teacher_id == teacher_id)
    )
    teacher_groups = teacher_groups_query.scalars().all()

    if not teacher_groups:
        return []  # учитель без групп → нет экзаменов

    # Получаем ID студентов этих групп через связующую таблицу
    from models import group_student_association
    students_query = await db.execute(
        select(group_student_association.c.student_id)
        .where(group_student_association.c.group_id.in_(teacher_groups))
    )
    student_ids = students_query.scalars().all()

    if not student_ids:
        return []

    # Получаем экзамены только этих студентов с загрузкой exam_type и created_by
    exams_query = await db.execute(
        select(Exam)
        .options(selectinload(Exam.exam_type), selectinload(Exam.created_by))
        .where(Exam.id_student.in_(student_ids))
        .offset(skip)
        .limit(limit)
    )
    exams = exams_query.scalars().all()

    return [schemas.ExamResponse.from_orm_with_name(exam) for exam in exams]

@app.get("/exams/{exam_id}", response_model=schemas.ExamResponse)
async def read_exam(exam_id: int, db: AsyncSession = Depends(get_db)):
    exam = await crud.get_exam(db=db, exam_id=exam_id)
    if exam is None:
        raise HTTPException(status_code=404, detail="Exam not found")
    return schemas.ExamResponse.from_orm_with_name(exam)

@app.put("/exams/{exam_id}", response_model=schemas.ExamResponse)
async def update_exam(
    exam_id: int,
    exam_update: schemas.ExamUpdate,
    db: AsyncSession = Depends(get_db)
):
    try:
        exam = await crud.update_exam(db=db, exam_id=exam_id, exam_update=exam_update)
        if exam is None:
            raise HTTPException(status_code=404, detail="Exam not found")
        return schemas.ExamResponse.from_orm_with_name(exam)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.delete("/exams/{exam_id}")
async def delete_exam(exam_id: int, db: AsyncSession = Depends(get_db)):
    success = await crud.delete_exam(db=db, exam_id=exam_id)
    if not success:
        raise HTTPException(status_code=404, detail="Exam not found")
    return {"message": "Exam deleted successfully"}

@app.get("/exams-with-students/", response_model=List[schemas.ExamWithStudentResponse])
async def read_exams_with_students(
    skip: int = 0, 
    limit: int = 100, 
    db: AsyncSession = Depends(get_db)
):
    exams = await crud.get_exams_with_students(db=db, skip=skip, limit=limit)
    # Преобразуем в ExamWithStudentResponse с названием и студентом
    result = []
    for exam in exams:
        exam_response = schemas.ExamResponse.from_orm_with_name(exam)
        result.append(schemas.ExamWithStudentResponse(
            **exam_response.model_dump(),
            student=schemas.StudentResponse(**normalize_student_data(exam.student))
        ))
    return result

# Exam type endpoints
@app.get("/exam-types/", response_model=List[schemas.ExamTypeResponse])
async def read_exam_types(
    group_id: Optional[int] = Query(None, description="ID группы для фильтрации"),
    db: AsyncSession = Depends(get_db)
):
    return await crud.get_exam_types(db, group_id=group_id)


@app.post("/exam-types/", response_model=schemas.ExamTypeResponse, status_code=201)
async def create_exam_type(
    exam_type: schemas.ExamTypeCreate,
    db: AsyncSession = Depends(get_db),
):
    if not exam_type.name.strip():
        raise HTTPException(status_code=400, detail="Название типа экзамена не может быть пустым")
    try:
        # Логируем полученные данные для отладки
        import json
        print(f"API: Creating exam type: name={exam_type.name}, group_id={exam_type.group_id}, completed_tasks={exam_type.completed_tasks}, type={type(exam_type.completed_tasks)}")
        result = await crud.create_exam_type(
            db, 
            exam_type.name.strip(), 
            exam_type.group_id,
            completed_tasks=exam_type.completed_tasks
        )
        print(f"API: Created exam type: id={result.id}, completed_tasks={result.completed_tasks}, type={type(result.completed_tasks)}")
        # Явно создаем ответ, чтобы убедиться, что completed_tasks включен
        # В Pydantic v1 используем parse_obj или просто конструктор
        response = schemas.ExamTypeResponse.parse_obj({
            'id': result.id,
            'name': result.name,
            'group_id': result.group_id,
            'completed_tasks': result.completed_tasks
        })
        # Проверяем, что completed_tasks включен в сериализацию
        response_dict = response.dict(exclude_none=False)
        print(f"API: Response dict: {response_dict}")
        return response
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        # Обработка IntegrityError (если все же произойдет)
        if "UNIQUE constraint" in str(e) or "IntegrityError" in str(type(e).__name__):
            raise HTTPException(
                status_code=400, 
                detail=f"Экзамен с названием '{exam_type.name}' уже существует в этой группе"
            )
        raise HTTPException(status_code=500, detail=f"Ошибка создания типа экзамена: {str(e)}")

@app.delete("/exam-types/{exam_type_id}")
async def delete_exam_type(exam_type_id: int, db: AsyncSession = Depends(get_db)):
    """Удаление типа экзамена. Все связанные экзамены также будут удалены."""
    success = await crud.delete_exam_type(db=db, exam_type_id=exam_type_id)
    if not success:
        raise HTTPException(status_code=404, detail="Exam type not found")
    return {"message": "Exam type and all related exams deleted successfully"}

# Group endpoints
@app.post("/groups/", response_model=schemas.GroupResponse)
async def create_group(group: schemas.GroupCreate, db: AsyncSession = Depends(get_db)):
    try:
        # Проверяем, что учитель существует
        teacher_query = await db.execute(select(Employee).where(Employee.id == group.teacher_id))
        teacher = teacher_query.scalar_one_or_none()
        if not teacher:
            raise HTTPException(status_code=404, detail="Учитель не найден")
        
        print(f"Creating group: {group}")
        created_group = await crud.create_group(db=db, group=group)
        print(f"Group created with id: {created_group.id}")
        
        # Делаем commit после создания группы
        await db.commit()
        await db.refresh(created_group)

        # Автогенерация уроков если есть расписание
        if created_group.schedule:
            from datetime import timedelta
            now = datetime.utcnow()
            end_date = now + timedelta(days=90)  # Генерируем уроки на 3 месяца
            await crud.generate_lessons_for_group(db, created_group.id, now, end_date)

        # Перезагружаем с учителем - используем новый запрос в той же сессии
        result = await db.execute(
            select(StudyGroup)
            .options(selectinload(StudyGroup.teacher), selectinload(StudyGroup.students))
            .where(StudyGroup.id == created_group.id)
        )
        group_with_teacher = result.scalar_one_or_none()
        
        if not group_with_teacher:
            raise HTTPException(status_code=404, detail="Созданная группа не найдена")
        
        print(f"Group loaded: id={group_with_teacher.id}, teacher={group_with_teacher.teacher}")
        response = schemas.GroupResponse.from_orm_with_teacher(group_with_teacher)
        print(f"Response created successfully")
        return response
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error in create_group endpoint: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Ошибка создания группы: {str(e)}")

@app.get("/groups/", response_model=List[schemas.GroupBase])
async def read_groups(
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(get_current_user)
):
    # Если учитель — показываем ТОЛЬКО его группы
    if user.get("role") == "teacher":
        username = user.get("username") or user.get("sub")
        if not username:
            # Если username отсутствует, возвращаем пустой список
            return []

        teacher_query = await db.execute(
            select(Employee.id).where(Employee.username == username)
        )
        teacher_id = teacher_query.scalar_one_or_none()

        if not teacher_id:
            # Если учитель не найден в БД, возвращаем пустой список
            return []

        # Получаем ТОЛЬКО группы этого учителя
        query = select(StudyGroup).options(selectinload(StudyGroup.teacher))
        query = query.where(StudyGroup.teacher_id == teacher_id)
    elif user.get("role") == "school_admin":
        # school_admin видит только группы своей школы
        school = user.get("school")
        if not school:
            return []

        query = select(StudyGroup).options(selectinload(StudyGroup.teacher))
        query = query.where(StudyGroup.school == school)
    else:
        # OWNER/ADMIN — получает все группы
        query = select(StudyGroup).options(selectinload(StudyGroup.teacher))

    result = await db.execute(query)
    groups = result.unique().scalars().all()

    # Преобразуем в схемы с информацией об учителе
    return [schemas.GroupBase.from_orm_with_teacher(g) for g in groups]

@app.get("/groups-with-students/", response_model=List[schemas.GroupResponse])
async def read_groups_with_students(
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(get_current_user)
):
    # Если учитель — показываем ТОЛЬКО его группы
    if user.get("role") == "teacher":
        username = user.get("username") or user.get("sub")
        if not username:
            # Если username отсутствует, возвращаем пустой список
            return []

        teacher_query = await db.execute(
            select(Employee.id).where(Employee.username == username)
        )
        teacher_id = teacher_query.scalar_one_or_none()

        if not teacher_id:
            # Если учитель не найден в БД, возвращаем пустой список
            return []

        # Получаем ТОЛЬКО группы этого учителя (строгая фильтрация)
        result = await db.execute(
            select(StudyGroup)
            .options(selectinload(StudyGroup.students), selectinload(StudyGroup.teacher))
            .where(StudyGroup.teacher_id == teacher_id)
        )
        groups = result.unique().scalars().all()
        return [schemas.GroupResponse.from_orm_with_teacher(g) for g in groups]

    # school_admin — показываем группы только его школы
    elif user.get("role") == "school_admin":
        school = user.get("school")
        if not school:
            return []

        result = await db.execute(
            select(StudyGroup)
            .options(selectinload(StudyGroup.students), selectinload(StudyGroup.teacher))
            .where(StudyGroup.school == school)
        )
        groups = result.unique().scalars().all()
        return [schemas.GroupResponse.from_orm_with_teacher(g) for g in groups]

    # OWNER/ADMIN — получает все группы
    elif user.get("role") in ["admin", "owner"]:
        groups = await crud.get_groups_with_students(db=db)
        return [schemas.GroupResponse.from_orm_with_teacher(g) for g in groups]

    # Если роль не определена - возвращаем пустой список
    return []

@app.get("/groups/{group_id}", response_model=schemas.GroupResponse)
async def read_group(group_id: int, db: AsyncSession = Depends(get_db)):
    group = await crud.get_group(db=db, group_id=group_id)
    if not group:
        raise HTTPException(status_code=404, detail="Группа не найдена")
    return schemas.GroupResponse.from_orm_with_teacher(group)

@app.put("/groups/{group_id}", response_model=schemas.GroupResponse)
async def update_group(
    group_id: int,
    group_update: GroupUpdate,
    db: AsyncSession = Depends(get_db)
):
    # Если обновляется teacher_id, проверяем что учитель существует
    if group_update.teacher_id is not None:
        teacher_query = await db.execute(select(Employee).where(Employee.id == group_update.teacher_id))
        teacher = teacher_query.scalar_one_or_none()
        if not teacher:
            raise HTTPException(status_code=404, detail="Учитель не найден")
    
    # Проверяем, изменилось ли расписание
    schedule_changed = hasattr(group_update, 'schedule') and group_update.schedule is not None

    group = await crud.update_group(db=db, group_id=group_id, group_update=group_update)
    if not group:
        raise HTTPException(status_code=404, detail="Группа не найдена")

    # Регенерируем уроки если изменилось расписание
    if schedule_changed:
        await crud.regenerate_lessons_for_updated_schedule(db, group_id)

    return schemas.GroupResponse.from_orm_with_teacher(group)

@app.put("/groups/{group_id}/students/")
async def update_group_students(
    group_id: int,
    data: GroupStudentsUpdate,
    db: AsyncSession = Depends(get_db)
):
    group = await crud.update_group_students(db=db, group_id=group_id, student_ids=data.student_ids)
    if not group:
        raise HTTPException(404, "Группа не найдена")
    return {"message": "Состав группы обновлён"}

@app.delete("/groups/{group_id}")
async def delete_group(group_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(StudyGroup).where(StudyGroup.id == group_id))
    group = result.scalar_one_or_none()
    if not group:
        raise HTTPException(status_code=404, detail="Группа не найдена")
    
    # Сначала получаем все связанные exam_types
    exam_types_result = await db.execute(
        select(ExamType).where(ExamType.group_id == group_id)
    )
    exam_types = exam_types_result.scalars().all()
    exam_type_ids = [et.id for et in exam_types]
    
    # Удаляем все exams, связанные с этими exam_types
    if exam_type_ids:
        exams_result = await db.execute(
            select(Exam).where(Exam.exam_type_id.in_(exam_type_ids))
        )
        exams = exams_result.scalars().all()
        for exam in exams:
            await db.delete(exam)
    
    # Затем удаляем exam_types
    for exam_type in exam_types:
        await db.delete(exam_type)
    
    # И наконец удаляем саму группу
    await db.delete(group)
    await db.commit()
    return {"message": "Группа удалена"}

# Employee endpoints
@app.get("/teachers/", response_model=List[schemas.EmployeeOut])
async def get_teachers(
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(require_owner)
):
    """Получение списка всех сотрудников (owner, school_admin, teacher)"""

    result = await db.execute(
        select(Employee).order_by(Employee.id)
    )
    employees = result.scalars().all()
    return [schemas.EmployeeOut.model_validate(e) for e in employees]

@app.post("/teachers/", response_model=schemas.EmployeeOut)
async def create_teacher(
    teacher_data: schemas.EmployeeCreate,
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(require_owner)
):
    """Создание нового учителя или school_admin (только для owner)"""
    
    # Проверяем, существует ли пользователь с таким username
    result = await db.execute(
        select(Employee).where(Employee.username == teacher_data.username)
    )
    existing_user = result.scalar_one_or_none()
    
    if existing_user:
        raise HTTPException(status_code=400, detail="Пользователь с таким именем уже существует")
    
    from auth import hash_password
    new_teacher = Employee(
        username=teacher_data.username,
        password_hash=hash_password(teacher_data.password),
        role=teacher_data.role if teacher_data.role else "teacher",
        teacher_name=teacher_data.teacher_name,
        school=teacher_data.school
    )
    
    db.add(new_teacher)
    await db.commit()
    await db.refresh(new_teacher)
    
    return schemas.EmployeeOut.model_validate(new_teacher)

@app.put("/teachers/{teacher_id}", response_model=schemas.EmployeeOut)
async def update_teacher(
    teacher_id: int,
    teacher_update: schemas.EmployeeUpdate,
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(require_owner)
):
    """Обновление учителя или school_admin (только для owner)"""

    result = await db.execute(
        select(Employee).where(Employee.id == teacher_id)
    )
    teacher = result.scalar_one_or_none()
    
    if not teacher:
        raise HTTPException(status_code=404, detail="Учитель не найден")
    
    # Обновляем поля
    update_data = teacher_update.dict(exclude_unset=True)
    
    # Если обновляется username, проверяем уникальность
    if "username" in update_data and update_data["username"] != teacher.username:
        existing_result = await db.execute(
            select(Employee).where(Employee.username == update_data["username"])
        )
        existing_user = existing_result.scalar_one_or_none()
        if existing_user:
            raise HTTPException(status_code=400, detail="Пользователь с таким именем уже существует")
        teacher.username = update_data["username"]
    
    # Если обновляется пароль, хешируем его
    if "password" in update_data:
        from auth import hash_password
        teacher.password_hash = hash_password(update_data["password"])
    
    if "teacher_name" in update_data:
        teacher.teacher_name = update_data["teacher_name"]

    if "school" in update_data:
        teacher.school = update_data["school"]

    await db.commit()
    await db.refresh(teacher)
    
    return schemas.EmployeeOut.model_validate(teacher)

@app.delete("/teachers/{teacher_id}")
async def delete_teacher(
    teacher_id: int,
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(require_owner)
):
    """Удаление сотрудника (только для owner). Нельзя удалить owner."""

    result = await db.execute(
        select(Employee).where(Employee.id == teacher_id)
    )
    teacher = result.scalar_one_or_none()

    if not teacher:
        raise HTTPException(status_code=404, detail="Сотрудник не найден")

    # Нельзя удалить owner
    if teacher.role == "owner":
        raise HTTPException(status_code=400, detail="Невозможно удалить владельца системы")
    
    # Перед удалением учителя устанавливаем teacher_id в NULL для всех его групп
    # Сначала нужно сделать teacher_id nullable в группах, но для безопасности
    # проверим, есть ли группы у учителя
    groups_result = await db.execute(
        select(StudyGroup).where(StudyGroup.teacher_id == teacher_id)
    )
    groups = groups_result.scalars().all()
    
    if groups:
        # Если есть группы, нельзя удалить учителя, так как teacher_id не nullable
        # Вместо этого можно либо запретить удаление, либо установить teacher_id в NULL
        # Но так как teacher_id не nullable, нужно либо изменить схему, либо запретить удаление
        # Для безопасности запретим удаление сотрудника с группами
        raise HTTPException(
            status_code=400,
            detail=f"Невозможно удалить сотрудника: у него есть {len(groups)} групп. Сначала удалите или переназначьте группы."
        )

    # Удаляем сотрудника только если у него нет групп
    await db.delete(teacher)
    await db.commit()

    return {"message": "Сотрудник успешно удален"}

# Exam registrations endpoints
@app.get("/exam-registrations/", response_model=List[schemas.ExamRegistrationWithStudentResponse])
async def get_exam_registrations(
    date: Optional[str] = Query(None, description="Фильтр по дате в формате YYYY-MM-DD"),
    school: Optional[str] = Query(None, description="Фильтр по школе (Байкальская или Лермонтова)"),
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(get_current_user)
):
    """Получение записей на экзамен через телеграм бот. Для учителей - только записи студентов из их групп."""
    # Строим запрос с загрузкой студента
    query = select(ExamRegistration).options(selectinload(ExamRegistration.student))
    
    # Если пользователь - учитель, фильтруем по студентам из его групп
    user_role = user.get("role")
    if user_role == "teacher":
        username = user.get("username") or user.get("sub")
        if not username:
            return []  # Если username отсутствует, возвращаем пустой список

        # Получаем ID учителя
        teacher_query = await db.execute(
            select(Employee.id).where(Employee.username == username)
        )
        teacher_id = teacher_query.scalar_one_or_none()

        if not teacher_id:
            return []  # Если учитель не найден, возвращаем пустой список

        # Получаем все группы этого учителя
        groups_query = await db.execute(
            select(StudyGroup.id).where(StudyGroup.teacher_id == teacher_id)
        )
        group_ids = [g[0] for g in groups_query.all()]

        if not group_ids:
            return []  # Если у учителя нет групп, возвращаем пустой список

        # Получаем всех студентов из этих групп через связующую таблицу
        students_query = await db.execute(
            select(group_student_association.c.student_id)
            .where(group_student_association.c.group_id.in_(group_ids))
        )
        student_ids = [s[0] for s in students_query.all()]

        if not student_ids:
            return []  # Если в группах нет студентов, возвращаем пустой список

        # Фильтруем записи по студентам из групп учителя
        query = query.where(ExamRegistration.student_id.in_(student_ids))

    # Если пользователь - school_admin, фильтруем по школе
    elif user_role == "school_admin":
        school_admin_school = user.get("school")
        if school_admin_school:
            query = query.where(ExamRegistration.school == school_admin_school)
    
    # Фильтр по дате, если указан
    if date:
        try:
            exam_date = datetime.strptime(date, "%Y-%m-%d").date()
            exam_datetime = datetime.combine(exam_date, datetime.min.time())
            query = query.where(ExamRegistration.exam_date == exam_datetime)
        except ValueError:
            raise HTTPException(status_code=400, detail="Некорректный формат даты. Используйте YYYY-MM-DD")
    
    # Фильтр по школе, если указан
    if school:
        query = query.where(ExamRegistration.school == school)
    
    # Сортируем по дате и времени
    query = query.order_by(ExamRegistration.exam_date, ExamRegistration.exam_time)
    
    result = await db.execute(query)
    registrations = result.scalars().all()
    
    # Преобразуем в схему с информацией о студенте
    result_list = []
    for reg in registrations:
        exam_date_str = ""
        if reg.exam_date:
            if isinstance(reg.exam_date, datetime):
                exam_date_str = reg.exam_date.date().strftime("%Y-%m-%d")
            else:
                exam_date_str = str(reg.exam_date)
        
        created_at_str = ""
        if reg.created_at:
            if isinstance(reg.created_at, datetime):
                created_at_str = reg.created_at.isoformat()
            else:
                created_at_str = str(reg.created_at)
        
        confirmed_at_str = None
        if reg.confirmed_at:
            if isinstance(reg.confirmed_at, datetime):
                confirmed_at_str = reg.confirmed_at.isoformat()
            else:
                confirmed_at_str = str(reg.confirmed_at)
        
        student_fio = reg.student.fio if reg.student else "Неизвестно"
        student_class = reg.student.class_num if reg.student else None
        
        result_list.append(schemas.ExamRegistrationWithStudentResponse(
            id=reg.id,
            student_id=reg.student_id,
            student_fio=student_fio,
            student_class=student_class,
            subject=reg.subject,
            exam_date=exam_date_str,
            exam_time=reg.exam_time,
            school=reg.school,
            created_at=created_at_str,
            confirmed=reg.confirmed,
            confirmed_at=confirmed_at_str,
            attended=getattr(reg, 'attended', False),
            submitted_work=getattr(reg, 'submitted_work', False)
        ))
    
    return result_list


@app.put("/exam-registrations/{registration_id}", response_model=schemas.ExamRegistrationWithStudentResponse)
async def update_exam_registration(
    registration_id: int,
    registration_update: schemas.ExamRegistrationUpdate,
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(get_current_user)
):
    """Обновление записи на экзамен (только для owner/admin)"""
    if user.get("role") not in ["owner", "admin"]:
        raise HTTPException(status_code=403, detail="Доступ запрещен. Только для owner.")
    
    # Находим запись
    result = await db.execute(
        select(ExamRegistration)
        .options(selectinload(ExamRegistration.student))
        .where(ExamRegistration.id == registration_id)
    )
    registration = result.scalar_one_or_none()
    
    if not registration:
        raise HTTPException(status_code=404, detail="Запись не найдена")
    
    # Обновляем поля
    update_data = registration_update.dict(exclude_unset=True)
    for field, value in update_data.items():
        setattr(registration, field, value)
    
    await db.commit()
    await db.refresh(registration)
    
    # Формируем ответ
    exam_date_str = ""
    if registration.exam_date:
        if isinstance(registration.exam_date, datetime):
            exam_date_str = registration.exam_date.date().strftime("%Y-%m-%d")
        else:
            exam_date_str = str(registration.exam_date)
    
    created_at_str = ""
    if registration.created_at:
        if isinstance(registration.created_at, datetime):
            created_at_str = registration.created_at.isoformat()
        else:
            created_at_str = str(registration.created_at)
    
    confirmed_at_str = None
    if registration.confirmed_at:
        if isinstance(registration.confirmed_at, datetime):
            confirmed_at_str = registration.confirmed_at.isoformat()
        else:
            confirmed_at_str = str(registration.confirmed_at)
    
    student_fio = registration.student.fio if registration.student else "Неизвестно"
    student_class = registration.student.class_num if registration.student else None
    
    return schemas.ExamRegistrationWithStudentResponse(
        id=registration.id,
        student_id=registration.student_id,
        student_fio=student_fio,
        student_class=student_class,
        subject=registration.subject,
        exam_date=exam_date_str,
        exam_time=registration.exam_time,
        school=registration.school,
        created_at=created_at_str,
        confirmed=registration.confirmed,
        confirmed_at=confirmed_at_str,
        attended=getattr(registration, 'attended', False),
        submitted_work=getattr(registration, 'submitted_work', False)
    )


# ==== ПРОБНИК (НАСТРОЙКИ ЭКЗАМЕНА) ====

@app.get("/probnik/", response_model=List[schemas.ProbnikResponse])
async def get_all_probniks(
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(get_current_user)
):
    """Получение всех пробников"""
    result = await db.execute(select(Probnik))
    probniks = result.scalars().all()
    
    response = []
    for p in probniks:
        # Преобразуем exam_dates_baikalskaya и exam_dates_lermontova если есть
        exam_dates_baikalskaya_dict = None
        if p.exam_dates_baikalskaya:
            if isinstance(p.exam_dates_baikalskaya, list):
                exam_dates_baikalskaya_dict = [
                    {
                        "label": d.get("label", ""),
                        "date": d.get("date", ""),
                        "times": d.get("times", [])
                    } for d in p.exam_dates_baikalskaya
                ]
            else:
                exam_dates_baikalskaya_dict = p.exam_dates_baikalskaya
        
        exam_dates_lermontova_dict = None
        if p.exam_dates_lermontova:
            if isinstance(p.exam_dates_lermontova, list):
                exam_dates_lermontova_dict = [
                    {
                        "label": d.get("label", ""),
                        "date": d.get("date", ""),
                        "times": d.get("times", [])
                    } for d in p.exam_dates_lermontova
                ]
            else:
                exam_dates_lermontova_dict = p.exam_dates_lermontova
        
        response.append(schemas.ProbnikResponse(
            id=p.id,
            name=p.name,
            is_active=p.is_active,
            created_at=p.created_at.isoformat() if p.created_at else None,
            slots_baikalskaya=p.slots_baikalskaya,
            slots_lermontova=p.slots_lermontova,
            exam_dates=p.exam_dates,
            exam_times=p.exam_times,
            exam_dates_baikalskaya=exam_dates_baikalskaya_dict,
            exam_dates_lermontova=exam_dates_lermontova_dict,
            exam_times_baikalskaya=p.exam_times_baikalskaya,
            exam_times_lermontova=p.exam_times_lermontova,
            max_registrations=p.max_registrations if p.max_registrations is not None else 4
        ))
    return response


@app.get("/probnik/active", response_model=Optional[schemas.ProbnikResponse])
async def get_active_probnik(db: AsyncSession = Depends(get_db)):
    """Получение активного пробника (для телеграм-бота)"""
    result = await db.execute(select(Probnik).where(Probnik.is_active == True))
    probnik = result.scalar_one_or_none()
    
    if not probnik:
        return None
    
    # Преобразуем exam_dates_baikalskaya и exam_dates_lermontova если есть
    exam_dates_baikalskaya_dict = None
    if probnik.exam_dates_baikalskaya:
        exam_dates_baikalskaya_dict = [{"label": d["label"], "date": d["date"]} for d in probnik.exam_dates_baikalskaya] if isinstance(probnik.exam_dates_baikalskaya, list) else probnik.exam_dates_baikalskaya
    
    exam_dates_lermontova_dict = None
    if probnik.exam_dates_lermontova:
        exam_dates_lermontova_dict = [{"label": d["label"], "date": d["date"]} for d in probnik.exam_dates_lermontova] if isinstance(probnik.exam_dates_lermontova, list) else probnik.exam_dates_lermontova
    
    return schemas.ProbnikResponse(
        id=probnik.id,
        name=probnik.name,
        is_active=probnik.is_active,
        created_at=probnik.created_at.isoformat() if probnik.created_at else None,
        slots_baikalskaya=probnik.slots_baikalskaya,
        slots_lermontova=probnik.slots_lermontova,
        exam_dates=probnik.exam_dates,
        exam_times=probnik.exam_times,
        exam_dates_baikalskaya=exam_dates_baikalskaya_dict,
        exam_dates_lermontova=exam_dates_lermontova_dict,
        exam_times_baikalskaya=probnik.exam_times_baikalskaya,
        exam_times_lermontova=probnik.exam_times_lermontova,
        max_registrations=probnik.max_registrations if probnik.max_registrations is not None else 4
    )


@app.post("/probnik/", response_model=schemas.ProbnikResponse)
async def create_probnik(
    probnik: schemas.ProbnikCreate,
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(get_current_user)
):
    """Создание нового пробника (только для админа)"""
    if user.get("role") not in ["owner", "admin"]:
        raise HTTPException(status_code=403, detail="Доступ запрещен")
    
    # Если создаем активный пробник, деактивируем остальные
    if probnik.is_active:
        await db.execute(
            select(Probnik).where(Probnik.is_active == True)
        )
        result = await db.execute(select(Probnik).where(Probnik.is_active == True))
        for p in result.scalars().all():
            p.is_active = False
    
    # Преобразуем exam_dates в словари
    exam_dates_dict = None
    if probnik.exam_dates:
        exam_dates_dict = [{"label": d.label, "date": d.date} for d in probnik.exam_dates]
    
    exam_dates_baikalskaya_dict = None
    if probnik.exam_dates_baikalskaya:
        exam_dates_baikalskaya_dict = [
            {
                "label": d.label,
                "date": d.date,
                "times": d.times if hasattr(d, 'times') and d.times else []
            } for d in probnik.exam_dates_baikalskaya
        ]
    
    exam_dates_lermontova_dict = None
    if probnik.exam_dates_lermontova:
        exam_dates_lermontova_dict = [
            {
                "label": d.label,
                "date": d.date,
                "times": d.times if hasattr(d, 'times') and d.times else []
            } for d in probnik.exam_dates_lermontova
        ]
    
    db_probnik = Probnik(
        name=probnik.name,
        is_active=probnik.is_active,
        slots_baikalskaya=probnik.slots_baikalskaya,
        slots_lermontova=probnik.slots_lermontova,
        exam_dates=exam_dates_dict,
        exam_times=probnik.exam_times,
        exam_dates_baikalskaya=exam_dates_baikalskaya_dict,
        exam_dates_lermontova=exam_dates_lermontova_dict,
        exam_times_baikalskaya=probnik.exam_times_baikalskaya,
        exam_times_lermontova=probnik.exam_times_lermontova
    )
    db.add(db_probnik)
    await db.commit()
    await db.refresh(db_probnik)
    
    return schemas.ProbnikResponse(
        id=db_probnik.id,
        name=db_probnik.name,
        is_active=db_probnik.is_active,
        created_at=db_probnik.created_at.isoformat() if db_probnik.created_at else None,
        slots_baikalskaya=db_probnik.slots_baikalskaya,
        slots_lermontova=db_probnik.slots_lermontova,
        exam_dates=db_probnik.exam_dates,
        exam_times=db_probnik.exam_times,
        exam_dates_baikalskaya=db_probnik.exam_dates_baikalskaya,
        exam_dates_lermontova=db_probnik.exam_dates_lermontova,
        exam_times_baikalskaya=db_probnik.exam_times_baikalskaya,
        exam_times_lermontova=db_probnik.exam_times_lermontova,
        max_registrations=db_probnik.max_registrations if db_probnik.max_registrations is not None else 4
    )


@app.put("/probnik/{probnik_id}", response_model=schemas.ProbnikResponse)
async def update_probnik(
    probnik_id: int,
    probnik_update: schemas.ProbnikUpdate,
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(get_current_user)
):
    """Обновление пробника"""
    if user.get("role") not in ["owner", "admin"]:
        raise HTTPException(status_code=403, detail="Доступ запрещен")
    
    result = await db.execute(select(Probnik).where(Probnik.id == probnik_id))
    probnik = result.scalar_one_or_none()
    
    if not probnik:
        raise HTTPException(status_code=404, detail="Пробник не найден")
    
    # Проверяем, активируется ли пробник (был неактивен, становится активным)
    was_inactive = not probnik.is_active
    becoming_active = probnik_update.is_active == True
    
    # Если активируем этот пробник, деактивируем остальные
    if probnik_update.is_active:
        other_result = await db.execute(select(Probnik).where(Probnik.id != probnik_id, Probnik.is_active == True))
        for p in other_result.scalars().all():
            p.is_active = False
    
    update_data = probnik_update.dict(exclude_unset=True)
    
    # Преобразуем exam_dates если есть
    if 'exam_dates' in update_data and update_data['exam_dates']:
        update_data['exam_dates'] = [{"label": d.label, "date": d.date} for d in probnik_update.exam_dates]
    
    # Преобразуем exam_dates_baikalskaya если есть
    if 'exam_dates_baikalskaya' in update_data and update_data['exam_dates_baikalskaya']:
        update_data['exam_dates_baikalskaya'] = [
            {
                "label": d.label,
                "date": d.date,
                "times": d.times if hasattr(d, 'times') and d.times else []
            } for d in probnik_update.exam_dates_baikalskaya
        ]
    
    # Преобразуем exam_dates_lermontova если есть
    if 'exam_dates_lermontova' in update_data and update_data['exam_dates_lermontova']:
        update_data['exam_dates_lermontova'] = [
            {
                "label": d.label,
                "date": d.date,
                "times": d.times if hasattr(d, 'times') and d.times else []
            } for d in probnik_update.exam_dates_lermontova
        ]
    
    for field, value in update_data.items():
        setattr(probnik, field, value)
    
    await db.commit()
    await db.refresh(probnik)
    
    # Преобразуем exam_dates_baikalskaya и exam_dates_lermontova если есть
    exam_dates_baikalskaya_dict = None
    if probnik.exam_dates_baikalskaya:
        if isinstance(probnik.exam_dates_baikalskaya, list):
            exam_dates_baikalskaya_dict = [
                {
                    "label": d.get("label", ""),
                    "date": d.get("date", ""),
                    "times": d.get("times", [])
                } for d in probnik.exam_dates_baikalskaya
            ]
        else:
            exam_dates_baikalskaya_dict = probnik.exam_dates_baikalskaya
    
    exam_dates_lermontova_dict = None
    if probnik.exam_dates_lermontova:
        if isinstance(probnik.exam_dates_lermontova, list):
            exam_dates_lermontova_dict = [
                {
                    "label": d.get("label", ""),
                    "date": d.get("date", ""),
                    "times": d.get("times", [])
                } for d in probnik.exam_dates_lermontova
            ]
        else:
            exam_dates_lermontova_dict = probnik.exam_dates_lermontova
    
    return schemas.ProbnikResponse(
        id=probnik.id,
        name=probnik.name,
        is_active=probnik.is_active,
        created_at=probnik.created_at.isoformat() if probnik.created_at else None,
        slots_baikalskaya=probnik.slots_baikalskaya,
        slots_lermontova=probnik.slots_lermontova,
        exam_dates=probnik.exam_dates,
        exam_times=probnik.exam_times,
        exam_dates_baikalskaya=exam_dates_baikalskaya_dict,
        exam_dates_lermontova=exam_dates_lermontova_dict,
        exam_times_baikalskaya=probnik.exam_times_baikalskaya,
        exam_times_lermontova=probnik.exam_times_lermontova,
        max_registrations=probnik.max_registrations if probnik.max_registrations is not None else 4
    )


@app.delete("/probnik/{probnik_id}")
async def delete_probnik(
    probnik_id: int,
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(get_current_user)
):
    """Удаление пробника"""
    if user.get("role") not in ["owner", "admin"]:
        raise HTTPException(status_code=403, detail="Доступ запрещен")

    result = await db.execute(select(Probnik).where(Probnik.id == probnik_id))
    probnik = result.scalar_one_or_none()

    if not probnik:
        raise HTTPException(status_code=404, detail="Пробник не найден")

    await db.delete(probnik)
    await db.commit()

    return {"message": "Пробник удален"}


# ==== ПУБЛИЧНЫЕ ЭНДПОИНТЫ (БЕЗ АВТОРИЗАЦИИ) ====

@app.get("/public/results/{access_token}", response_model=schemas.PublicStudentResultsResponse)
async def get_public_student_results(
    access_token: str,
    db: AsyncSession = Depends(get_db)
):
    """Публичный доступ к результатам студента по уникальному токену"""
    student = await crud.get_student_by_token(db=db, access_token=access_token)

    if not student:
        raise HTTPException(status_code=404, detail="Результаты не найдены. Проверьте правильность ссылки.")

    # Преобразуем экзамены с названиями
    exams = [schemas.ExamResponse.from_orm_with_name(exam) for exam in student.exams]

    return schemas.PublicStudentResultsResponse(
        fio=student.fio,
        exams=exams
    )


# ==== SUBJECTS (ПРЕДМЕТЫ) ====

@app.get("/subjects/", response_model=List[schemas.SubjectResponse])
async def get_subjects(
    only_active: bool = Query(False, description="Показывать только активные предметы"),
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(get_current_user)
):
    """Получение списка всех предметов"""
    subjects = await crud.get_subjects(db, only_active=only_active)
    result = []
    for s in subjects:
        result.append(schemas.SubjectResponse(
            id=s.id,
            code=s.code,
            name=s.name,
            exam_type=s.exam_type,
            tasks_count=s.tasks_count,
            max_per_task=s.max_per_task,
            primary_to_secondary_scale=s.primary_to_secondary_scale,
            grade_scale=[schemas.GradeScaleItem(**g) for g in s.grade_scale] if s.grade_scale else None,
            special_config=s.special_config,
            topics=[schemas.TopicItem(**t) for t in s.topics] if s.topics else None,
            is_active=s.is_active,
            created_at=s.created_at.isoformat() if s.created_at else None,
            updated_at=s.updated_at.isoformat() if s.updated_at else None
        ))
    return result


@app.get("/subjects/{subject_id}", response_model=schemas.SubjectResponse)
async def get_subject(
    subject_id: int,
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(get_current_user)
):
    """Получение предмета по ID"""
    subject = await crud.get_subject(db, subject_id)
    if not subject:
        raise HTTPException(status_code=404, detail="Предмет не найден")

    return schemas.SubjectResponse(
        id=subject.id,
        code=subject.code,
        name=subject.name,
        exam_type=subject.exam_type,
        tasks_count=subject.tasks_count,
        max_per_task=subject.max_per_task,
        primary_to_secondary_scale=subject.primary_to_secondary_scale,
        grade_scale=[schemas.GradeScaleItem(**g) for g in subject.grade_scale] if subject.grade_scale else None,
        special_config=subject.special_config,
        topics=[schemas.TopicItem(**t) for t in subject.topics] if subject.topics else None,
        is_active=subject.is_active,
        created_at=subject.created_at.isoformat() if subject.created_at else None,
        updated_at=subject.updated_at.isoformat() if subject.updated_at else None
    )


@app.post("/subjects/", response_model=schemas.SubjectResponse)
async def create_subject(
    subject: schemas.SubjectCreate,
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(require_owner)
):
    """Создание нового предмета (только для owner)"""

    try:
        db_subject = await crud.create_subject(db, subject)
        return schemas.SubjectResponse(
            id=db_subject.id,
            code=db_subject.code,
            name=db_subject.name,
            exam_type=db_subject.exam_type,
            tasks_count=db_subject.tasks_count,
            max_per_task=db_subject.max_per_task,
            primary_to_secondary_scale=db_subject.primary_to_secondary_scale,
            grade_scale=[schemas.GradeScaleItem(**g) for g in db_subject.grade_scale] if db_subject.grade_scale else None,
            special_config=db_subject.special_config,
            topics=[schemas.TopicItem(**t) for t in db_subject.topics] if db_subject.topics else None,
            is_active=db_subject.is_active,
            created_at=db_subject.created_at.isoformat() if db_subject.created_at else None,
            updated_at=db_subject.updated_at.isoformat() if db_subject.updated_at else None
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.put("/subjects/{subject_id}", response_model=schemas.SubjectResponse)
async def update_subject(
    subject_id: int,
    subject_update: schemas.SubjectUpdate,
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(require_owner)
):
    """Обновление предмета (только для owner)"""

    try:
        db_subject = await crud.update_subject(db, subject_id, subject_update)
        if not db_subject:
            raise HTTPException(status_code=404, detail="Предмет не найден")

        return schemas.SubjectResponse(
            id=db_subject.id,
            code=db_subject.code,
            name=db_subject.name,
            exam_type=db_subject.exam_type,
            tasks_count=db_subject.tasks_count,
            max_per_task=db_subject.max_per_task,
            primary_to_secondary_scale=db_subject.primary_to_secondary_scale,
            grade_scale=[schemas.GradeScaleItem(**g) for g in db_subject.grade_scale] if db_subject.grade_scale else None,
            special_config=db_subject.special_config,
            topics=[schemas.TopicItem(**t) for t in db_subject.topics] if db_subject.topics else None,
            is_active=db_subject.is_active,
            created_at=db_subject.created_at.isoformat() if db_subject.created_at else None,
            updated_at=db_subject.updated_at.isoformat() if db_subject.updated_at else None
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.delete("/subjects/{subject_id}")
async def delete_subject(
    subject_id: int,
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(require_owner)
):
    """Удаление предмета (только для owner)"""

    success = await crud.delete_subject(db, subject_id)
    if not success:
        raise HTTPException(status_code=404, detail="Предмет не найден")

    return {"message": "Предмет успешно удален"}


# ==================== WORK SESSION ENDPOINTS ====================

@app.post("/work-sessions/start", response_model=schemas.WorkSessionResponse)
async def start_work_session(
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(require_owner_or_school_admin)
):
    """Начать рабочую сессию"""
    # Получаем ID сотрудника из токена
    username = user.get("username") or user.get("sub")
    result = await db.execute(select(Employee).where(Employee.username == username))
    employee = result.scalar_one_or_none()

    if not employee:
        raise HTTPException(status_code=404, detail="Сотрудник не найден")

    try:
        session = await crud.start_work_session(db, employee.id)
        return schemas.WorkSessionResponse(
            id=session.id,
            employee_id=session.employee_id,
            employee_name=employee.teacher_name,
            start_time=session.start_time.isoformat(),
            end_time=None,
            duration_minutes=None
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/work-sessions/{session_id}/end", response_model=schemas.WorkSessionResponse)
async def end_work_session(
    session_id: int,
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(require_owner_or_school_admin)
):
    """Завершить рабочую сессию"""
    try:
        session = await crud.end_work_session(db, session_id)
        if not session:
            raise HTTPException(status_code=404, detail="Сессия не найдена")

        # Получаем имя сотрудника
        result = await db.execute(select(Employee).where(Employee.id == session.employee_id))
        employee = result.scalar_one_or_none()

        return schemas.WorkSessionResponse(
            id=session.id,
            employee_id=session.employee_id,
            employee_name=employee.teacher_name if employee else None,
            start_time=session.start_time.isoformat(),
            end_time=session.end_time.isoformat() if session.end_time else None,
            duration_minutes=session.duration_minutes
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.get("/work-sessions/", response_model=List[schemas.WorkSessionResponse])
async def get_work_sessions(
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(require_owner_or_school_admin)
):
    """Получить историю рабочих сессий"""
    # Owner видит всех, school_admin только свои
    employee_id = None
    if user.get("role") == "school_admin":
        username = user.get("username") or user.get("sub")
        result = await db.execute(select(Employee).where(Employee.username == username))
        employee = result.scalar_one_or_none()
        if employee:
            employee_id = employee.id

    sessions = await crud.get_work_sessions(db, employee_id)

    return [
        schemas.WorkSessionResponse(
            id=s.id,
            employee_id=s.employee_id,
            employee_name=s.employee.teacher_name if s.employee else None,
            start_time=s.start_time.isoformat(),
            end_time=s.end_time.isoformat() if s.end_time else None,
            duration_minutes=s.duration_minutes
        )
        for s in sessions
    ]


@app.get("/work-sessions/active", response_model=schemas.WorkSessionResponse | None)
async def get_active_work_session(
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(require_owner_or_school_admin)
):
    """Получить активную рабочую сессию текущего пользователя"""
    username = user.get("username") or user.get("sub")
    result = await db.execute(select(Employee).where(Employee.username == username))
    employee = result.scalar_one_or_none()

    if not employee:
        raise HTTPException(status_code=404, detail="Сотрудник не найден")

    session = await crud.get_active_work_session(db, employee.id)

    if not session:
        return None

    return schemas.WorkSessionResponse(
        id=session.id,
        employee_id=session.employee_id,
        employee_name=employee.teacher_name,
        start_time=session.start_time.isoformat(),
        end_time=None,
        duration_minutes=None
    )


# ==================== TASK ENDPOINTS ====================

@app.get("/employees/assignable", response_model=List[schemas.EmployeeOut])
async def get_assignable_employees(
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(require_owner_or_school_admin)
):
    """Список сотрудников для назначения задачи.
    Owner видит всех school_admin.
    School_admin видит себя + других school_admin + owner/admin.
    """
    if user.get("role") in ["owner", "admin"]:
        query = select(Employee).where(Employee.role == "school_admin")
    else:
        query = select(Employee).where(
            Employee.role.in_(["owner", "admin", "school_admin"])
        )
    result = await db.execute(query)
    employees = result.scalars().all()
    return [schemas.EmployeeOut.model_validate(e) for e in employees]


@app.post("/tasks/", response_model=schemas.TaskResponse)
async def create_task(
    task: schemas.TaskCreate,
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(require_owner_or_school_admin)
):
    """Создать задачу (owner или school_admin)"""
    # Получаем ID создателя
    username = user.get("username") or user.get("sub")
    result = await db.execute(select(Employee).where(Employee.username == username))
    employee = result.scalar_one_or_none()

    if not employee:
        raise HTTPException(status_code=404, detail="Сотрудник не найден")

    db_task = await crud.create_task(db, task.dict(), employee.id)

    # Получаем имена создателя и исполнителя
    created_by = employee
    result = await db.execute(select(Employee).where(Employee.id == db_task.assigned_to_id))
    assigned_to = result.scalar_one_or_none()

    return schemas.TaskResponse(
        id=db_task.id,
        title=db_task.title,
        description=db_task.description,
        deadline=utc_iso(db_task.deadline),
        deadline_type=db_task.deadline_type,
        status=db_task.status,
        linked_students=db_task.linked_students or [],
        created_by_id=db_task.created_by_id,
        created_by_name=created_by.teacher_name if created_by else None,
        assigned_to_id=db_task.assigned_to_id,
        assigned_to_name=assigned_to.teacher_name if assigned_to else None,
        created_at=utc_iso(db_task.created_at),
        updated_at=utc_iso(db_task.updated_at)
    )


@app.get("/tasks/", response_model=List[schemas.TaskResponse])
async def get_tasks(
    report_date: Optional[str] = Query(None, description="YYYY-MM-DD — показать незавершённые + завершённые за этот день"),
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(require_owner_or_school_admin)
):
    """Получить задачи (owner видит все, school_admin только свои)"""
    employee_id = None
    if user.get("role") == "school_admin":
        username = user.get("username") or user.get("sub")
        result = await db.execute(select(Employee).where(Employee.username == username))
        employee = result.scalar_one_or_none()
        if employee:
            employee_id = employee.id

    tasks = await crud.get_tasks(db, employee_id, report_date=report_date)

    return [
        schemas.TaskResponse(
            id=t.id,
            title=t.title,
            description=t.description,
            deadline=utc_iso(t.deadline),
            deadline_type=t.deadline_type,
            status=t.status,
            linked_students=t.linked_students or [],
            created_by_id=t.created_by_id,
            created_by_name=t.created_by.teacher_name if t.created_by else None,
            assigned_to_id=t.assigned_to_id,
            assigned_to_name=t.assigned_to.teacher_name if t.assigned_to else None,
            created_at=utc_iso(t.created_at),
            updated_at=utc_iso(t.updated_at),
            completed_at=utc_iso(t.completed_at)
        )
        for t in tasks
    ]


@app.put("/tasks/{task_id}", response_model=schemas.TaskResponse)
async def update_task(
    task_id: int,
    task_update: schemas.TaskUpdate,
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(require_owner_or_school_admin)
):
    """Обновить задачу"""
    # Получаем задачу
    db_task = await crud.get_task(db, task_id)
    if not db_task:
        raise HTTPException(status_code=404, detail="Задача не найдена")

    # school_admin может менять только статус своих задач
    if user.get("role") == "school_admin":
        username = user.get("username") or user.get("sub")
        result = await db.execute(select(Employee).where(Employee.username == username))
        employee = result.scalar_one_or_none()

        if not employee or db_task.assigned_to_id != employee.id:
            raise HTTPException(status_code=403, detail="Вы можете обновлять только свои задачи")

        # school_admin может менять только статус
        update_data = {"status": task_update.status} if task_update.status else {}
    else:
        # owner может менять все
        update_data = task_update.dict(exclude_unset=True)

    updated_task = await crud.update_task(db, task_id, update_data)

    return schemas.TaskResponse(
        id=updated_task.id,
        title=updated_task.title,
        description=updated_task.description,
        deadline=updated_task.deadline.isoformat() if updated_task.deadline else None,
        status=updated_task.status,
        created_by_id=updated_task.created_by_id,
        created_by_name=updated_task.created_by.teacher_name if updated_task.created_by else None,
        assigned_to_id=updated_task.assigned_to_id,
        assigned_to_name=updated_task.assigned_to.teacher_name if updated_task.assigned_to else None,
        created_at=updated_task.created_at.isoformat(),
        updated_at=updated_task.updated_at.isoformat()
    )


# ==================== REPORT ENDPOINTS ====================

def _compute_task_count(report, tasks_by_employee: dict) -> int:
    """Считает задачи: активные если онлайн, закрытые за день если завершён."""
    emp_tasks = tasks_by_employee.get(report.employee_id, [])
    if report.work_end_time is None:
        return sum(1 for t in emp_tasks if t.status not in ('completed',))
    else:
        report_date = report.report_date.date() if hasattr(report.report_date, 'date') else report.report_date
        return sum(1 for t in emp_tasks if t.completed_at and t.completed_at.date() == report_date)


@app.post("/reports/start", response_model=schemas.ReportResponse)
async def start_report(
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(require_owner_or_school_admin)
):
    """Начать рабочий день — создаёт или возвращает открытый отчёт"""
    username = user.get("username") or user.get("sub")
    result = await db.execute(select(Employee).where(Employee.username == username))
    employee = result.scalar_one_or_none()
    if not employee:
        raise HTTPException(status_code=404, detail="Сотрудник не найден")

    db_report = await crud.start_report(db, employee.id)

    tasks_q = await db.execute(select(Task).where(Task.assigned_to_id == employee.id))
    tasks = tasks_q.scalars().all()
    task_count = sum(1 for t in tasks if t.status not in ('completed',))

    return schemas.ReportResponse(
        id=db_report.id,
        employee_id=db_report.employee_id,
        employee_name=employee.teacher_name,
        report_date=db_report.report_date.strftime("%Y-%m-%d") if hasattr(db_report.report_date, 'strftime') else str(db_report.report_date),
        created_at=utc_iso(db_report.created_at),
        work_start_time=utc_iso(db_report.work_start_time),
        work_end_time=None,
        leads=None,
        trial_scheduled=0,
        trial_attended=0,
        notified_tomorrow="",
        cancellations="",
        churn="",
        money=None,
        water="",
        supplies_needed="",
        comments="",
        task_count=task_count
    )


@app.post("/reports/", response_model=schemas.ReportResponse)
async def create_report(
    report: schemas.ReportCreate,
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(require_owner_or_school_admin)
):
    """Создать отчет"""
    # Получаем ID сотрудника
    username = user.get("username") or user.get("sub")
    result = await db.execute(select(Employee).where(Employee.username == username))
    employee = result.scalar_one_or_none()

    if not employee:
        raise HTTPException(status_code=404, detail="Сотрудник не найден")

    db_report = await crud.create_report(db, report.dict(), employee.id)

    # Парсим JSON поля обратно в Pydantic модели
    leads_data = schemas.LeadsData(**db_report.leads) if db_report.leads else None
    money_data = schemas.MoneyData(**db_report.money) if db_report.money else None

    return schemas.ReportResponse(
        id=db_report.id,
        employee_id=db_report.employee_id,
        employee_name=employee.teacher_name,
        report_date=db_report.report_date.strftime("%Y-%m-%d"),
        created_at=utc_iso(db_report.created_at),
        work_start_time=utc_iso(db_report.work_start_time),
        work_end_time=utc_iso(db_report.work_end_time),
        leads=leads_data,
        trial_scheduled=db_report.trial_scheduled,
        trial_attended=db_report.trial_attended,
        notified_tomorrow=db_report.notified_tomorrow or "",
        cancellations=db_report.cancellations or "",
        churn=db_report.churn or "",
        money=money_data,
        water=db_report.water or "",
        supplies_needed=db_report.supplies_needed or "",
        comments=db_report.comments or ""
    )


@app.get("/reports/", response_model=List[schemas.ReportResponse])
async def get_reports(
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(require_owner_or_school_admin)
):
    """Получить отчеты (owner видит все, school_admin только свои)"""
    employee_id = None
    if user.get("role") == "school_admin":
        username = user.get("username") or user.get("sub")
        result = await db.execute(select(Employee).where(Employee.username == username))
        employee = result.scalar_one_or_none()
        if employee:
            employee_id = employee.id

    reports = await crud.get_reports(db, employee_id)

    # Загружаем задачи для подсчёта
    emp_ids = list({r.employee_id for r in reports})
    tasks_by_emp = defaultdict(list)
    if emp_ids:
        tq = await db.execute(select(Task).where(Task.assigned_to_id.in_(emp_ids)))
        for t in tq.scalars().all():
            tasks_by_emp[t.assigned_to_id].append(t)

    result_list = []
    for r in reports:
        leads_data = schemas.LeadsData(**r.leads) if r.leads else None
        money_data = schemas.MoneyData(**r.money) if r.money else None

        result_list.append(schemas.ReportResponse(
            id=r.id,
            employee_id=r.employee_id,
            employee_name=r.employee.teacher_name if r.employee else None,
            report_date=r.report_date.strftime("%Y-%m-%d"),
            created_at=utc_iso(r.created_at),
            work_start_time=utc_iso(r.work_start_time),
            work_end_time=utc_iso(r.work_end_time),
            leads=leads_data,
            trial_scheduled=r.trial_scheduled or 0,
            trial_attended=r.trial_attended or 0,
            notified_tomorrow=r.notified_tomorrow or "",
            cancellations=r.cancellations or "",
            churn=r.churn or "",
            money=money_data,
            water=r.water or "",
            supplies_needed=r.supplies_needed or "",
            comments=r.comments or "",
            task_count=_compute_task_count(r, tasks_by_emp)
        ))

    return result_list


@app.put("/reports/{report_id}", response_model=schemas.ReportResponse)
async def update_report(
    report_id: int,
    report: schemas.ReportUpdate,
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(require_owner_or_school_admin)
):
    """Обновить отчет (owner — любой, school_admin — только свой)"""
    # school_admin может менять только свой отчёт
    if user.get("role") == "school_admin":
        username = user.get("username") or user.get("sub")
        emp_r = await db.execute(select(Employee).where(Employee.username == username))
        me = emp_r.scalar_one_or_none()
        check = await db.execute(select(Report).where(Report.id == report_id))
        existing = check.scalar_one_or_none()
        if not existing or not me or existing.employee_id != me.id:
            raise HTTPException(status_code=403, detail="Нет доступа к этому отчёту")

    db_report = await crud.update_report(db, report_id, report.dict(exclude_none=True))
    if not db_report:
        raise HTTPException(status_code=404, detail="Отчет не найден")

    result = await db.execute(select(Employee).where(Employee.id == db_report.employee_id))
    employee = result.scalar_one_or_none()
    leads_data = schemas.LeadsData(**db_report.leads) if db_report.leads else None
    money_data = schemas.MoneyData(**db_report.money) if db_report.money else None

    tq = await db.execute(select(Task).where(Task.assigned_to_id == db_report.employee_id))
    tasks = {db_report.employee_id: tq.scalars().all()}
    task_count = _compute_task_count(db_report, tasks)

    return schemas.ReportResponse(
        id=db_report.id,
        employee_id=db_report.employee_id,
        employee_name=employee.teacher_name if employee else None,
        report_date=db_report.report_date.strftime("%Y-%m-%d"),
        created_at=utc_iso(db_report.created_at),
        work_start_time=utc_iso(db_report.work_start_time),
        work_end_time=utc_iso(db_report.work_end_time),
        leads=leads_data,
        trial_scheduled=db_report.trial_scheduled or 0,
        trial_attended=db_report.trial_attended or 0,
        notified_tomorrow=db_report.notified_tomorrow or "",
        cancellations=db_report.cancellations or "",
        churn=db_report.churn or "",
        money=money_data,
        water=db_report.water or "",
        supplies_needed=db_report.supplies_needed or "",
        comments=db_report.comments or "",
        task_count=task_count
    )


@app.delete("/reports/{report_id}", status_code=204)
async def delete_report(
    report_id: int,
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(require_owner)
):
    """Удалить отчет (только owner)"""
    deleted = await crud.delete_report(db, report_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Отчет не найден")


# ==================== LESSON ENDPOINTS ====================

async def get_employee_id_from_user(db: AsyncSession, user: dict) -> int:
    """Получить employee_id из объекта user"""
    username = user.get("username") or user.get("sub")
    result = await db.execute(select(Employee).where(Employee.username == username))
    employee = result.scalar_one_or_none()
    if not employee:
        raise HTTPException(status_code=404, detail="Сотрудник не найден")
    return employee.id

@app.get("/lessons/my")
async def get_my_lessons(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(get_current_user)
):
    """Получить уроки текущего пользователя (учителя, администратора школы или владельца)"""
    employee_id = await get_employee_id_from_user(db, user)
    employee = await crud.get_employee(db, employee_id)

    start_dt = datetime.fromisoformat(start_date.replace("Z", "+00:00")) if start_date else None
    end_dt = datetime.fromisoformat(end_date.replace("Z", "+00:00")) if end_date else None

    # Получаем уроки в зависимости от роли
    if user["role"] == "owner":
        lessons = await crud.get_all_lessons(db, start_dt, end_dt)
    elif user["role"] == "school_admin":
        lessons = await crud.get_lessons_by_school(db, employee.school, start_dt, end_dt)
    elif user["role"] == "teacher":
        lessons = await crud.get_lessons_by_teacher(db, employee_id, start_dt, end_dt)
    else:
        raise HTTPException(status_code=403, detail="Доступ запрещен")

    return [
        {
            "id": lesson.id,
            "group_id": lesson.group_id,
            "group_name": lesson.group.name if lesson.group else None,
            "lesson_date": utc_iso(lesson.lesson_date),
            "duration_minutes": lesson.duration_minutes,
            "topic": lesson.topic,
            "homework": lesson.homework,
            "grading_mode": lesson.grading_mode,
            "total_tasks": lesson.total_tasks,
            "homework_total_tasks": lesson.homework_total_tasks,
            "auto_generated": lesson.auto_generated,
            "is_cancelled": lesson.is_cancelled,
            "is_completed": lesson.is_completed,
            "completed_at": utc_iso(lesson.completed_at),
            "completed_by_id": lesson.completed_by_id,
            "completed_by_name": lesson.completed_by.teacher_name if lesson.completed_by else None,
            "created_at": utc_iso(lesson.created_at),
            "updated_at": utc_iso(lesson.updated_at),
            "attendances_count": len(lesson.attendances) if lesson.attendances else 0
        }
        for lesson in lessons
    ]


@app.get("/lessons/{lesson_id}")
async def get_lesson_detail(
    lesson_id: int,
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(get_current_user)
):
    """Получить детальную информацию об уроке с посещаемостью"""
    lesson = await crud.get_lesson(db, lesson_id)
    if not lesson:
        raise HTTPException(status_code=404, detail="Урок не найден")

    # Проверка доступа
    employee_id = await get_employee_id_from_user(db, user)
    employee = await crud.get_employee(db, employee_id)

    if user["role"] == "teacher":
        if lesson.group.teacher_id != employee_id:
            raise HTTPException(status_code=403, detail="Нет доступа к этому уроку")
    elif user["role"] == "school_admin":
        if lesson.group.school != employee.school:
            raise HTTPException(status_code=403, detail="Нет доступа к этому уроку")

    return {
        "id": lesson.id,
        "group_id": lesson.group_id,
        "group_name": lesson.group.name if lesson.group else None,
        "lesson_date": utc_iso(lesson.lesson_date),
        "duration_minutes": lesson.duration_minutes,
        "topic": lesson.topic,
        "homework": lesson.homework,
        "grading_mode": lesson.grading_mode,
        "total_tasks": lesson.total_tasks,
        "homework_total_tasks": lesson.homework_total_tasks,
        "auto_generated": lesson.auto_generated,
        "is_cancelled": lesson.is_cancelled,
        "cancellation_reason": lesson.cancellation_reason,
        "is_completed": lesson.is_completed,
        "completed_at": utc_iso(lesson.completed_at),
        "completed_by_id": lesson.completed_by_id,
        "completed_by_name": lesson.completed_by.teacher_name if lesson.completed_by else None,
        "created_at": utc_iso(lesson.created_at),
        "updated_at": utc_iso(lesson.updated_at),
        "students": [
            {
                "id": student.id,
                "fio": student.fio,
                "phone": student.phone
            }
            for student in lesson.group.students
        ] if lesson.group and lesson.group.students else [],
        "attendances": [
            {
                "id": att.id,
                "student_id": att.student_id,
                "student_fio": att.student.fio if att.student else None,
                "attendance_status": att.attendance_status,
                "grade_value": att.grade_value,
                "homework_grade_value": att.homework_grade_value,
                "comment": att.comment
            }
            for att in lesson.attendances
        ] if lesson.attendances else []
    }


@app.post("/lessons/")
async def create_lesson(
    lesson: schemas.LessonCreate,
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(get_current_user)
):
    """Создать урок вручную"""
    if user["role"] not in ["teacher", "owner"]:
        raise HTTPException(status_code=403, detail="Доступ только для учителей")

    employee_id = await get_employee_id_from_user(db, user)

    lesson_data = lesson.dict()
    created_lesson = await crud.create_lesson(db, lesson_data, employee_id)

    return {
        "id": created_lesson.id,
        "group_id": created_lesson.group_id,
        "lesson_date": utc_iso(created_lesson.lesson_date),
        "duration_minutes": created_lesson.duration_minutes,
        "topic": created_lesson.topic,
        "homework": created_lesson.homework,
        "grading_mode": created_lesson.grading_mode,
        "total_tasks": created_lesson.total_tasks,
        "homework_total_tasks": created_lesson.homework_total_tasks,
        "auto_generated": created_lesson.auto_generated,
        "created_at": utc_iso(created_lesson.created_at)
    }


@app.put("/lessons/{lesson_id}")
async def update_lesson(
    lesson_id: int,
    lesson: schemas.LessonUpdate,
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(get_current_user)
):
    """Обновить урок"""
    if user["role"] not in ["teacher", "owner"]:
        raise HTTPException(status_code=403, detail="Доступ только для учителей")

    # Проверка доступа
    existing_lesson = await crud.get_lesson(db, lesson_id)
    if not existing_lesson:
        raise HTTPException(status_code=404, detail="Урок не найден")

    if user["role"] == "teacher":
        employee_id = await get_employee_id_from_user(db, user)
        if existing_lesson.group.teacher_id != employee_id:
            raise HTTPException(status_code=403, detail="Нет доступа к этому уроку")

    updated_lesson = await crud.update_lesson(db, lesson_id, lesson.dict(exclude_unset=True))

    return {
        "id": updated_lesson.id,
        "lesson_date": utc_iso(updated_lesson.lesson_date),
        "duration_minutes": updated_lesson.duration_minutes,
        "topic": updated_lesson.topic,
        "grading_mode": updated_lesson.grading_mode,
        "total_tasks": updated_lesson.total_tasks,
        "homework_total_tasks": updated_lesson.homework_total_tasks,
        "updated_at": utc_iso(updated_lesson.updated_at)
    }


@app.post("/lessons/{lesson_id}/cancel")
async def cancel_lesson(
    lesson_id: int,
    reason: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(get_current_user)
):
    """Отменить урок"""
    if user["role"] not in ["teacher", "owner"]:
        raise HTTPException(status_code=403, detail="Доступ только для учителей")

    # Проверка доступа
    existing_lesson = await crud.get_lesson(db, lesson_id)
    if not existing_lesson:
        raise HTTPException(status_code=404, detail="Урок не найден")

    if user["role"] == "teacher":
        employee_id = await get_employee_id_from_user(db, user)
        if existing_lesson.group.teacher_id != employee_id:
            raise HTTPException(status_code=403, detail="Нет доступа к этому уроку")

    cancelled_lesson = await crud.cancel_lesson(db, lesson_id, reason)

    return {
        "id": cancelled_lesson.id,
        "is_cancelled": cancelled_lesson.is_cancelled,
        "cancellation_reason": cancelled_lesson.cancellation_reason,
        "updated_at": utc_iso(cancelled_lesson.updated_at)
    }


@app.delete("/lessons/{lesson_id}", status_code=204)
async def delete_lesson(
    lesson_id: int,
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(get_current_user)
):
    """Удалить урок"""
    if user["role"] not in ["teacher", "owner"]:
        raise HTTPException(status_code=403, detail="Доступ только для учителей")

    # Проверка доступа
    existing_lesson = await crud.get_lesson(db, lesson_id)
    if not existing_lesson:
        raise HTTPException(status_code=404, detail="Урок не найден")

    if user["role"] == "teacher":
        employee_id = await get_employee_id_from_user(db, user)
        if existing_lesson.group.teacher_id != employee_id:
            raise HTTPException(status_code=403, detail="Нет доступа к этому уроку")

    deleted = await crud.delete_lesson(db, lesson_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Урок не найден")


@app.post("/lessons/{lesson_id}/fill")
async def fill_lesson(
    lesson_id: int,
    fill_data: schemas.LessonFillData,
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(get_current_user)
):
    """Заполнить посещаемость урока"""
    if user["role"] not in ["teacher", "owner", "school_admin"]:
        raise HTTPException(status_code=403, detail="Доступ запрещен")

    # Проверка доступа
    existing_lesson = await crud.get_lesson(db, lesson_id)
    if not existing_lesson:
        raise HTTPException(status_code=404, detail="Урок не найден")

    employee_id = await get_employee_id_from_user(db, user)
    employee = await crud.get_employee(db, employee_id)

    if user["role"] == "teacher":
        if existing_lesson.group.teacher_id != employee_id:
            raise HTTPException(status_code=403, detail="Нет доступа к этому уроку")
    elif user["role"] == "school_admin":
        if existing_lesson.group.school != employee.school:
            raise HTTPException(status_code=403, detail="Нет доступа к этому уроку")

    attendances_list = [att.dict() for att in fill_data.attendances]
    filled_lesson = await crud.fill_lesson(db, lesson_id, attendances_list, completed_by_id=employee_id)

    return {
        "id": filled_lesson.id,
        "is_completed": filled_lesson.is_completed,
        "completed_at": utc_iso(filled_lesson.completed_at),
        "attendances": [
            {
                "id": att.id,
                "student_id": att.student_id,
                "attendance_status": att.attendance_status,
                "grade_value": att.grade_value,
                "homework_grade_value": att.homework_grade_value,
                "comment": att.comment
            }
            for att in filled_lesson.attendances
        ]
    }


@app.post("/lessons/generate/{group_id}")
async def generate_lessons(
    group_id: int,
    months: int = 3,
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(require_owner_or_school_admin)
):
    """Сгенерировать уроки для группы на N месяцев вперед"""
    from datetime import timedelta

    start_date = datetime.utcnow()
    end_date = start_date + timedelta(days=months * 30)

    created_lessons = await crud.generate_lessons_for_group(db, group_id, start_date, end_date)

    return {
        "created_count": len(created_lessons),
        "lessons": [
            {
                "id": lesson.id,
                "lesson_date": utc_iso(lesson.lesson_date),
                "duration_minutes": lesson.duration_minutes
            }
            for lesson in created_lessons
        ]
    }


# ==================== EMPLOYEE ENDPOINTS ====================

@app.get("/employees/", response_model=List[schemas.EmployeeOut])
async def get_employees(
    role: Optional[str] = Query(None, description="Фильтр по роли"),
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(require_owner)
):
    """Получить список сотрудников (только для owner)"""
    query = select(Employee)

    if role:
        query = query.where(Employee.role == role)

    result = await db.execute(query)
    employees = result.scalars().all()

    return [schemas.EmployeeOut.model_validate(e) for e in employees]


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8000)