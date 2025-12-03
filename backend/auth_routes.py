from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from database import get_db
from models import Employee
from schemas import EmployeeCreate, EmployeeOut
from auth import hash_password, verify_password, create_access_token

router = APIRouter(prefix="/auth", tags=["Auth"])


# ----------- LOGIN -----------
@router.post("/login")
async def login(username: str, password: str, db: AsyncSession = Depends(get_db)):
    user = await db.query(Employee).filter(Employee.username == username).first()

    if not user:
        raise HTTPException(status_code=401, detail="User not found")

    if not verify_password(password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid password")

    token = create_access_token({
        "sub": user.username,
        "role": user.role,
        "teacher_name": user.teacher_name
    })

    return {
        "access_token": token,
        "role": user.role,
        "teacher_name": user.teacher_name
    }


# -------- REGISTER EMPLOYEE -----------
@router.post("/register", response_model=EmployeeOut)
async def register(data: EmployeeCreate, db: AsyncSession = Depends(get_db)):
    # First user becomes admin automatically
    q  =(await db.execute(select(Employee))).scalars().all()
    if len(q) == 0:
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
    db.commit()
    db.refresh(new_user)

    return new_user
