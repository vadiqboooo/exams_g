from pydantic import BaseModel, field_validator, validator, Field
from typing import Optional, List, Dict
import re

def normalize_student_for_response(student):
    """Нормализует данные студента для создания StudentResponse"""
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
    
    return {
        'id': student.id,
        'fio': student.fio,
        'phone': getattr(student, 'phone', None),
        'user_id': user_id,
        'class_num': class_num,
        'admin_comment': getattr(student, 'admin_comment', None),
        'parent_contact_status': getattr(student, 'parent_contact_status', None)
    }

class StudentBase(BaseModel):
    fio: str
    phone: Optional[str] = None
    user_id: Optional[int] = None  # Telegram user ID
    class_num: Optional[int] = None  # Класс ученика (9, 10, 11)

class StudentCreate(StudentBase):
    pass

class StudentUpdate(BaseModel):
    fio: Optional[str] = None
    phone: Optional[str] = None
    admin_comment: Optional[str] = None
    parent_contact_status: Optional[str] = None
    user_id: Optional[int] = None
    class_num: Optional[int] = None
    
    @field_validator('parent_contact_status')
    @classmethod
    def validate_status(cls, v):
        if v is not None and v not in ['informed', 'callback', 'no_answer', '']:
            raise ValueError('Статус должен быть: informed, callback или no_answer')
        return v
    
    @field_validator('class_num')
    @classmethod
    def validate_class(cls, v):
        if v is not None and v not in [9, 10, 11]:
            raise ValueError('Класс должен быть: 9, 10 или 11')
        return v

class StudentResponse(StudentBase):
    id: int
    admin_comment: Optional[str] = None
    parent_contact_status: Optional[str] = None
    
    class Config:
        from_attributes = True

class ExamBase(BaseModel):
    exam_type_id: int  # ID типа экзамена (название берется из exam_type)
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
    exam_type_id: Optional[int] = None
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

class ExamResponse(BaseModel):
    id: int
    exam_type_id: int
    id_student: int
    subject: str
    answer: Optional[str] = None
    comment: Optional[str] = None
    name: Optional[str] = None  # Название экзамена из exam_type (будет заполняться через relationship)
    
    class Config:
        from_attributes = True
    
    @classmethod
    def from_orm_with_name(cls, obj):
        """Создает ExamResponse с названием из exam_type"""
        data = {
            'id': obj.id,
            'exam_type_id': obj.exam_type_id,
            'id_student': obj.id_student,
            'subject': obj.subject,
            'answer': obj.answer,
            'comment': obj.comment,
            'name': obj.exam_type.name if obj.exam_type else None
        }
        return cls(**data)

class ExamWithStudentResponse(ExamResponse):
    student: StudentResponse


# ==== ТИПЫ ЭКЗАМЕНОВ ====

class ExamTypeBase(BaseModel):
    name: str
    group_id: int
    completed_tasks: Optional[List[int]] = None  # Массив номеров пройденных заданий


class ExamTypeCreate(ExamTypeBase):
    pass


class ExamTypeResponse(ExamTypeBase):
    id: int

    class Config:
        from_attributes = True
    
    def dict(self, **kwargs):
        """Переопределяем dict, чтобы всегда включать completed_tasks"""
        data = super().dict(**kwargs)
        # Убеждаемся, что completed_tasks всегда присутствует в ответе
        if 'completed_tasks' not in data or data.get('completed_tasks') is None:
            # Если completed_tasks отсутствует или None, устанавливаем его из объекта
            data['completed_tasks'] = self.completed_tasks
        return data

class StudentWithExamsResponse(StudentResponse):
    exams: List[ExamResponse] = []

# === ОБНОВЛЁННЫЕ СХЕМЫ ДЛЯ ГРУПП ===

class GroupCreate(BaseModel):
    name: str
    school: Optional[str] = None
    exam_type: Optional[str] = None
    subject: Optional[str] = None
    teacher_id: int
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
    teacher_id: Optional[int] = None
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
    teacher_id: int
    teacher_name: Optional[str] = None  # Имя учителя из relationship
    schedule: Optional[Dict[str, str]] = None
    students: List[StudentResponse] = []
    
    class Config:
        from_attributes = True
    
    @classmethod
    def from_orm_with_teacher(cls, obj):
        """Создает GroupResponse с информацией об учителе"""
        try:
            # Безопасное получение teacher_name
            teacher_name = None
            if hasattr(obj, 'teacher') and obj.teacher is not None:
                teacher_name = getattr(obj.teacher, 'teacher_name', None) or getattr(obj.teacher, 'username', None)
            
            # Безопасное получение students - используем простой подход
            students = []
            if hasattr(obj, 'students') and obj.students:
                for s in obj.students:
                    try:
                        # Нормализуем данные и создаем StudentResponse
                        student_dict = normalize_student_for_response(s)
                        students.append(StudentResponse(**student_dict))
                    except Exception as e:
                        print(f"Error creating StudentResponse for student {s.id}: {e}")
                        # Пропускаем проблемного студента, но продолжаем
                        continue
            
            data = {
                'id': obj.id,
                'name': obj.name,
                'school': getattr(obj, 'school', None),
                'exam_type': getattr(obj, 'exam_type', None),
                'subject': getattr(obj, 'subject', None),
                'teacher_id': obj.teacher_id,
                'teacher_name': teacher_name,
                'schedule': getattr(obj, 'schedule', None),
                'students': students
            }
            return cls(**data)
        except Exception as e:
            print(f"Error in from_orm_with_teacher: {e}")
            print(f"Object type: {type(obj)}")
            print(f"Object attributes: {dir(obj)}")
            import traceback
            traceback.print_exc()
            raise

class GroupWithStudentsResponse(BaseModel):
    id: int
    name: str
    school: Optional[str] = None
    exam_type: Optional[str] = None
    subject: Optional[str] = None
    teacher_id: int
    teacher_name: Optional[str] = None
    schedule: Optional[Dict[str, str]] = None
    students: List[StudentResponse] = []

    class Config:
        from_attributes = True
    
    @classmethod
    def from_orm_with_teacher(cls, obj):
        """Создает GroupWithStudentsResponse с информацией об учителе"""
        data = {
            'id': obj.id,
            'name': obj.name,
            'school': obj.school,
            'exam_type': obj.exam_type,
            'subject': obj.subject,
            'teacher_id': obj.teacher_id,
            'teacher_name': obj.teacher.teacher_name if obj.teacher else None,
            'schedule': obj.schedule,
            'students': [StudentResponse(**normalize_student_for_response(s)) for s in obj.students] if obj.students else []
        }
        return cls(**data)

class GroupStudentsUpdate(BaseModel):
    student_ids: List[int] = []

class GroupBase(BaseModel):
    id: int
    name: str
    school: Optional[str] = None
    exam_type: Optional[str] = None
    subject: Optional[str] = None
    teacher_id: int
    teacher_name: Optional[str] = None
    
    class Config:
        from_attributes = True
    
    @classmethod
    def from_orm_with_teacher(cls, obj):
        """Создает GroupBase с информацией об учителе"""
        data = {
            'id': obj.id,
            'name': obj.name,
            'school': obj.school,
            'exam_type': obj.exam_type,
            'subject': obj.subject,
            'teacher_id': obj.teacher_id,
            'teacher_name': obj.teacher.teacher_name if obj.teacher else None
        }
        return cls(**data)

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

# ==== СХЕМЫ ДЛЯ ТЕЛЕГРАМ-БОТА ====

class ExamRegistrationCreate(BaseModel):
    student_id: int
    subject: str
    exam_date: str  # Дата в формате "YYYY-MM-DD"
    exam_time: str  # "9:00" или "12:00"

class ExamRegistrationResponse(BaseModel):
    id: int
    student_id: int
    subject: str
    exam_date: str
    exam_time: str
    created_at: str
    confirmed: bool
    confirmed_at: Optional[str] = None
    
    class Config:
        from_attributes = True

class StudentSearchRequest(BaseModel):
    fio: str  # Фамилия и имя

class StudentSearchResponse(BaseModel):
    id: int
    fio: str
    groups: List[str]  # Список названий групп
    class_num: Optional[int] = None

class StudentConfirmRequest(BaseModel):
    student_id: int
    user_id: int  # Telegram user ID

class SubjectListResponse(BaseModel):
    subjects: List[str]  # Список предметов для ОГЭ или ЕГЭ

class ExamRegistrationWithStudentResponse(BaseModel):
    """Запись на экзамен с информацией о студенте"""
    id: int
    student_id: int
    student_fio: str
    student_class: Optional[int] = None
    subject: str
    exam_date: str
    exam_time: str
    created_at: str
    confirmed: bool
    confirmed_at: Optional[str] = None
    
    class Config:
        from_attributes = True