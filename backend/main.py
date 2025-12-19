from fastapi import FastAPI, Depends, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload
from typing import List, Optional
from datetime import datetime
import os

from database import get_db, create_tables
import crud
import schemas
from schemas import GroupStudentsUpdate, GroupUpdate
from models import Base, Student, Exam, StudyGroup, Employee, ExamRegistration, Probnik

from auth_routes import router as auth_router
from auth import get_current_user
from telegram_routes import router as telegram_router


app = FastAPI(title="Student Exam System", version="1.0.0")

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
        'schools': schools if schools else None
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
    db: AsyncSession = Depends(get_db)
):
    students = await crud.get_students(db=db, skip=skip, limit=limit)
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
    db: AsyncSession = Depends(get_db)
):
    student = await crud.get_student(db=db, student_id=exam.id_student)
    if student is None:
        raise HTTPException(status_code=404, detail="Student not found")
    
    try:
        created_exam = await crud.create_exam(db=db, exam=exam)
        # Перезагружаем с exam_type для получения названия
        result = await db.execute(
            select(Exam)
            .options(selectinload(Exam.exam_type))
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
 
    # ADMIN — получает всё
    if user.get("role") == "admin":
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

    # Получаем экзамены только этих студентов с загрузкой exam_type
    exams_query = await db.execute(
        select(Exam)
        .options(selectinload(Exam.exam_type))
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
    else:
        # ADMIN — получает все группы
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
    
    # ADMIN — получает все группы
    # Для всех остальных ролей (включая неопределенные) возвращаем пустой список
    # чтобы избежать случайного показа всех групп
    if user.get("role") == "admin":
        groups = await crud.get_groups_with_students(db=db)
        return [schemas.GroupResponse.from_orm_with_teacher(g) for g in groups]
    
    # Если роль не определена или не admin/teacher - возвращаем пустой список
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
    
    group = await crud.update_group(db=db, group_id=group_id, group_update=group_update)
    if not group:
        raise HTTPException(status_code=404, detail="Группа не найдена")
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
    
    await db.delete(group)
    await db.commit()
    return {"message": "Группа удалена"}

# Employee endpoints
@app.get("/teachers/", response_model=List[schemas.EmployeeOut])
async def get_teachers(db: AsyncSession = Depends(get_db)):
    """Получение списка всех учителей"""
    result = await db.execute(
        select(Employee).where(Employee.role == "teacher")
    )
    teachers = result.scalars().all()
    return [schemas.EmployeeOut.model_validate(t) for t in teachers]

# Exam registrations endpoints (admin only)
@app.get("/exam-registrations/", response_model=List[schemas.ExamRegistrationWithStudentResponse])
async def get_exam_registrations(
    date: Optional[str] = Query(None, description="Фильтр по дате в формате YYYY-MM-DD"),
    school: Optional[str] = Query(None, description="Фильтр по школе (Байкальская или Лермонтова)"),
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(get_current_user)
):
    """Получение всех записей на экзамен через телеграм бот (только для администратора)"""
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Доступ запрещен. Только для администратора")
    
    # Строим запрос с загрузкой студента
    query = select(ExamRegistration).options(selectinload(ExamRegistration.student))
    
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
    """Обновление записи на экзамен (только для администратора)"""
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Доступ запрещен. Только для администратора")
    
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
            exam_dates_baikalskaya_dict = [{"label": d["label"], "date": d["date"]} for d in p.exam_dates_baikalskaya] if isinstance(p.exam_dates_baikalskaya, list) else p.exam_dates_baikalskaya
        
        exam_dates_lermontova_dict = None
        if p.exam_dates_lermontova:
            exam_dates_lermontova_dict = [{"label": d["label"], "date": d["date"]} for d in p.exam_dates_lermontova] if isinstance(p.exam_dates_lermontova, list) else p.exam_dates_lermontova
        
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
    if user.get("role") != "admin":
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
        exam_dates_baikalskaya_dict = [{"label": d.label, "date": d.date} for d in probnik.exam_dates_baikalskaya]
    
    exam_dates_lermontova_dict = None
    if probnik.exam_dates_lermontova:
        exam_dates_lermontova_dict = [{"label": d.label, "date": d.date} for d in probnik.exam_dates_lermontova]
    
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
    if user.get("role") != "admin":
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
        update_data['exam_dates_baikalskaya'] = [{"label": d.label, "date": d.date} for d in probnik_update.exam_dates_baikalskaya]
    
    # Преобразуем exam_dates_lermontova если есть
    if 'exam_dates_lermontova' in update_data and update_data['exam_dates_lermontova']:
        update_data['exam_dates_lermontova'] = [{"label": d.label, "date": d.date} for d in probnik_update.exam_dates_lermontova]
    
    for field, value in update_data.items():
        setattr(probnik, field, value)
    
    await db.commit()
    await db.refresh(probnik)
    
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


@app.delete("/probnik/{probnik_id}")
async def delete_probnik(
    probnik_id: int,
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(get_current_user)
):
    """Удаление пробника"""
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Доступ запрещен")
    
    result = await db.execute(select(Probnik).where(Probnik.id == probnik_id))
    probnik = result.scalar_one_or_none()
    
    if not probnik:
        raise HTTPException(status_code=404, detail="Пробник не найден")
    
    await db.delete(probnik)
    await db.commit()
    
    return {"message": "Пробник удален"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8000)