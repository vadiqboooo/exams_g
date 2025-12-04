from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from database import get_db
from models import Employee
from schemas import EmployeeCreate, EmployeeOut, LoginResponse
from auth import hash_password, verify_password, create_access_token

router = APIRouter(prefix="/auth", tags=["Auth"])


# ----------- LOGIN -----------
@router.post("/login", response_model=LoginResponse)
async def login(username: str, password: str, db: AsyncSession = Depends(get_db)):
    # Используем правильный асинхронный запрос
    result = await db.execute(
        select(Employee).where(Employee.username == username)
    )
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(status_code=401, detail="User not found")

    if not verify_password(password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid password")

    token = create_access_token({
        "sub": user.username,
        "role": user.role,
        "teacher_name": user.teacher_name
    })

    return LoginResponse(
        access_token=token,
        role=user.role,
        teacher_name=user.teacher_name
    )


# -------- REGISTER EMPLOYEE -----------
@router.post("/register", response_model=EmployeeOut)
async def register(data: EmployeeCreate, db: AsyncSession = Depends(get_db)):
    # Проверяем, существует ли пользователь с таким username
    result = await db.execute(
        select(Employee).where(Employee.username == data.username)
    )
    existing_user = result.scalar_one_or_none()
    
    if existing_user:
        raise HTTPException(status_code=400, detail="Username already exists")
    
    # First user becomes admin automatically
    result = await db.execute(select(Employee))
    all_users = result.scalars().all()
    
    if len(all_users) == 0:
        role = "admin"
    else:
        role = data.role

    new_user = Employee(
        username=data.username,
        password_hash=hash_password(data.password),
        role=role,
        teacher_name=data.teacher_name
    )

    db.add(new_user)
    await db.commit()
    await db.refresh(new_user)

    return EmployeeOut.from_orm(new_user)  # Конвертируем в Pydantic модель