from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from typing import List
import os

from database import get_db, create_tables
import crud
import schemas
from schemas import GroupStudentsUpdate, GroupUpdate
from models import Base, Student, Exam, StudyGroup

from auth_routes import router as auth_router
from auth import get_current_user


app = FastAPI(title="Student Exam System", version="1.0.0")

os.makedirs("static", exist_ok=True)
app.mount("/static", StaticFiles(directory="static"), name="static")

app.include_router(auth_router)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
async def startup_event():
    await create_tables()

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
    if user["role"] == "admin":
        return await crud.get_exams(db=db, skip=skip, limit=limit)

    # TEACHER — получаем список групп учителя
    teacher_groups_query = await db.execute(
        select(StudyGroup.id).where(StudyGroup.teacher == user["teacher_name"])
    )
    teacher_groups = teacher_groups_query.scalars().all()

    if not teacher_groups:
        return []  # учитель без групп → нет экзаменов

    # Получаем ID студентов этих групп
    students_query = await db.execute(
        select(Student.id).where(Student.group_id.in_(teacher_groups))
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
    return await crud.create_group(db=db, group=group)

@app.get("/groups/", response_model=List[schemas.GroupBase])
async def read_groups(
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(get_current_user)
):
    query = select(StudyGroup)

    # Если учитель — показываем только его группы
    if user["role"] == "teacher":
        query = query.where(StudyGroup.teacher == user["teacher_name"])

    result = await db.execute(query)
    groups = result.scalars().all()
    return groups

@app.get("/groups-with-students/", response_model=List[schemas.GroupResponse])
async def read_groups_with_students(db: AsyncSession = Depends(get_db)):
    return await crud.get_groups_with_students(db=db)

@app.get("/groups/{group_id}", response_model=schemas.GroupResponse)
async def read_group(group_id: int, db: AsyncSession = Depends(get_db)):
    group = await crud.get_group(db=db, group_id=group_id)
    if not group:
        raise HTTPException(status_code=404, detail="Группа не найдена")
    return group

@app.put("/groups/{group_id}", response_model=schemas.GroupResponse)
async def update_group(
    group_id: int,
    group_update: GroupUpdate,
    db: AsyncSession = Depends(get_db)
):
    group = await crud.update_group(db=db, group_id=group_id, group_update=group_update)
    if not group:
        raise HTTPException(status_code=404, detail="Группа не найдена")
    return group

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


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8000)