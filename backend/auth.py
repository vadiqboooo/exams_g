from datetime import datetime, timedelta
from jose import jwt
from passlib.context import CryptContext
from fastapi.security import OAuth2PasswordBearer
from fastapi import Depends, HTTPException
import bcrypt

SECRET_KEY = "CHANGE_ME_TO_SOME_RANDOM_SECRET"
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24  # 1 день

# Авторизационный схем
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")


# ---- Хэширование пароля (используем bcrypt напрямую) ----
def hash_password(password: str) -> str:
    """Хеширует пароль с автоматической обрезкой до 72 байт"""
    # Отладка
    print(f"[DEBUG] Хеширование пароля длиной: {len(password)} символов, {len(password.encode('utf-8'))} байт")
    
    # Обрезаем до 72 байт
    password_bytes = password.encode('utf-8')[:72]
    
    # Хешируем
    hashed = bcrypt.hashpw(password_bytes, bcrypt.gensalt())
    
    # Возвращаем как строку
    return hashed.decode('utf-8')


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Проверяет пароль с автоматической обрезкой до 72 байт"""
    try:
        # Обрезаем до 72 байт
        password_bytes = plain_password.encode('utf-8')[:72]
        hashed_bytes = hashed_password.encode('utf-8')
        
        return bcrypt.checkpw(password_bytes, hashed_bytes)
    except Exception:
        return False


# ---- Создание токена ----
def create_access_token(data: dict):
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})

    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


# ---- Получение текущего пользователя из токена ----
def get_current_user(token: str = Depends(oauth2_scheme)):
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return payload  # {sub, role, teacher_name}
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid or expired token")