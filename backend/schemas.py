from pydantic import BaseModel, field_validator, validator, Field
from typing import Optional, List, Dict
import re

class StudentBase(BaseModel):
    fio: str
    phone: Optional[str] = None

class StudentCreate(StudentBase):
    pass

class StudentUpdate(BaseModel):
    fio: Optional[str] = None
    phone: Optional[str] = None
    admin_comment: Optional[str] = None
    parent_contact_status: Optional[str] = None
    
    @field_validator('parent_contact_status')
    @classmethod
    def validate_status(cls, v):
        if v is not None and v not in ['informed', 'callback', 'no_answer', '']:
            raise ValueError('Статус должен быть: informed, callback или no_answer')
        return v

class StudentResponse(StudentBase):
    id: int
    admin_comment: Optional[str] = None
    parent_contact_status: Optional[str] = None
    
    class Config:
        from_attributes = True

class ExamBase(BaseModel):
    name: str
    id_student: int
    subject: str
    answer: Optional[str] = None
    comment: Optional[str] = None

    @field_validator('answer')
    @classmethod
    def validate_answer(cls, v):
        if v is not None and v.strip():
            if not re.match(r'^[\d\-\s,]+$', v.strip()):
                raise ValueError('Ответ должен содержать только цифры, тире (-), запятые и пробелы')
        return v

class ExamCreate(ExamBase):
    pass

class ExamUpdate(BaseModel):
    name: Optional[str] = None
    subject: Optional[str] = None
    answer: Optional[str] = None
    comment: Optional[str] = None

    @field_validator('answer')
    @classmethod
    def validate_answer(cls, v):
        if v is not None and v.strip():
            if not re.match(r'^[\d\-\s,]+$', v.strip()):
                raise ValueError('Ответ должен содержать только цифры, тире (-), запятые и пробелы')
        return v

class ExamResponse(ExamBase):
    id: int
    
    class Config:
        from_attributes = True

class ExamWithStudentResponse(ExamResponse):
    student: StudentResponse

class StudentWithExamsResponse(StudentResponse):
    exams: List[ExamResponse] = []

# === ОБНОВЛЁННЫЕ СХЕМЫ ДЛЯ ГРУПП ===

class GroupCreate(BaseModel):
    name: str
    school: Optional[str] = None
    exam_type: Optional[str] = None
    subject: Optional[str] = None
    teacher: str
    schedule: Optional[Dict[str, str]] = None
    
    @field_validator('exam_type')
    @classmethod
    def validate_exam_type(cls, v):
        if v is not None and v not in ['ЕГЭ', 'ОГЭ', '']:
            raise ValueError('Тип экзамена должен быть: ЕГЭ или ОГЭ')
        return v

class GroupUpdate(BaseModel):
    name: Optional[str] = None
    school: Optional[str] = None
    exam_type: Optional[str] = None
    subject: Optional[str] = None
    teacher: Optional[str] = None
    schedule: Optional[Dict[str, str]] = None
    
    @field_validator('exam_type')
    @classmethod
    def validate_exam_type(cls, v):
        if v is not None and v not in ['ЕГЭ', 'ОГЭ', '', None]:
            raise ValueError('Тип экзамена должен быть: ЕГЭ или ОГЭ')
        return v

class GroupResponse(BaseModel):
    id: int
    name: str
    school: Optional[str] = None
    exam_type: Optional[str] = None
    subject: Optional[str] = None
    teacher: str
    schedule: Optional[Dict[str, str]] = None
    students: List[StudentResponse] = []
    
    class Config:
        from_attributes = True

class GroupWithStudentsResponse(BaseModel):
    id: int
    name: str
    school: Optional[str] = None
    exam_type: Optional[str] = None
    subject: Optional[str] = None
    teacher: str
    schedule: Optional[Dict[str, str]] = None
    students: List[StudentResponse] = []

    class Config:
        from_attributes = True

class GroupStudentsUpdate(BaseModel):
    student_ids: List[int] = []

class GroupBase(BaseModel):
    id: int
    name: str
    school: Optional[str] = None
    exam_type: Optional[str] = None
    subject: Optional[str] = None
    
    class Config:
        from_attributes = True

# Для регистрации
class EmployeeCreate(BaseModel):
    username: str
    password: str
    role: Optional[str] = "teacher"
    teacher_name: str
    
    @field_validator('password')
    @classmethod
    def validate_password(cls, v):
        if len(v) < 6:
            raise ValueError('Пароль должен быть не менее 6 символов')
        return v

# Для вывода информации о сотруднике (без пароля)
class EmployeeOut(BaseModel):
    id: int
    username: str
    role: str
    teacher_name: str

    
    class Config:
        from_attributes = True  # Для работы с ORM объектами SQLAlchemy

# Для аутентификации
class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"

# Для ответа при логине
class LoginResponse(BaseModel):
    access_token: str
    role: str
    teacher_name: str