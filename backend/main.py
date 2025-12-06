from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload
from typing import List
import os

from database import get_db, create_tables
import crud
import schemas
from schemas import GroupStudentsUpdate, GroupUpdate
from models import Base, Student, Exam, StudyGroup, Employee

from auth_routes import router as auth_router
from auth import get_current_user


app = FastAPI(title="Student Exam System", version="1.0.0")

# CORS middleware должен быть добавлен ПЕРВЫМ, до всех остальных middleware и роутеров
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:8000",
        "http://127.0.0.1:8000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
)

os.makedirs("static", exist_ok=True)
app.mount("/static", StaticFiles(directory="static"), name="static")

app.include_router(auth_router)

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
    return await crud.create_student(db=db, student=student)

@app.get("/students/", response_model=List[schemas.StudentResponse])
async def read_students(
    skip: int = 0, 
    limit: int = 100, 
    db: AsyncSession = Depends(get_db)
):
    students = await crud.get_students(db=db, skip=skip, limit=limit)
    return students

@app.get("/students/{student_id}", response_model=schemas.StudentResponse)
async def read_student(student_id: int, db: AsyncSession = Depends(get_db)):
    student = await crud.get_student(db=db, student_id=student_id)
    if student is None:
        raise HTTPException(status_code=404, detail="Student not found")
    return student

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
        return await crud.create_exam(db=db, exam=exam)
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
        return await crud.get_exams(db=db, skip=skip, limit=limit)
    
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

    # Получаем экзамены только этих студентов
    exams_query = await db.execute(
        select(Exam)
        .where(Exam.id_student.in_(student_ids))
        .offset(skip)
        .limit(limit)
    )
    exams = exams_query.scalars().all()

    return exams

@app.get("/exams/{exam_id}", response_model=schemas.ExamResponse)
async def read_exam(exam_id: int, db: AsyncSession = Depends(get_db)):
    exam = await crud.get_exam(db=db, exam_id=exam_id)
    if exam is None:
        raise HTTPException(status_code=404, detail="Exam not found")
    return exam

@app.put("/exams/{exam_id}", response_model=schemas.ExamResponse)
async def update_exam(
    exam_id: int,
    exam_update: schemas.ExamUpdate,
    db: AsyncSession = Depends(get_db)
):
    exam = await crud.update_exam(db=db, exam_id=exam_id, exam_update=exam_update)
    if exam is None:
        raise HTTPException(status_code=404, detail="Exam not found")
    return exam

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
    return exams

# Group endpoints
@app.post("/groups/", response_model=schemas.GroupResponse)
async def create_group(group: schemas.GroupCreate, db: AsyncSession = Depends(get_db)):
    # Проверяем, что учитель существует
    teacher_query = await db.execute(select(Employee).where(Employee.id == group.teacher_id))
    teacher = teacher_query.scalar_one_or_none()
    if not teacher:
        raise HTTPException(status_code=404, detail="Учитель не найден")
    
    created_group = await crud.create_group(db=db, group=group)
    # Перезагружаем с учителем
    result = await db.execute(
        select(StudyGroup)
        .options(selectinload(StudyGroup.teacher), selectinload(StudyGroup.students))
        .where(StudyGroup.id == created_group.id)
    )
    group_with_teacher = result.scalar_one_or_none()
    return schemas.GroupResponse.from_orm_with_teacher(group_with_teacher)

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


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8000)