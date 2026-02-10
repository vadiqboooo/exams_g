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
        'parent_contact_status': getattr(student, 'parent_contact_status', None),
        'access_token': getattr(student, 'access_token', None)
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
    regenerate_access_token: Optional[bool] = None  # Флаг для регенерации токена

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
    schools: Optional[List[str]] = None  # Список школ из записей на экзамен
    access_token: Optional[str] = None  # Уникальный токен для доступа к результатам

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
    # created_by_id будет заполняться автоматически на сервере
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
    created_by_id: Optional[int] = None  # ID создателя
    created_by_name: Optional[str] = None  # Имя создателя

    class Config:
        from_attributes = True

    @classmethod
    def from_orm_with_name(cls, obj):
        """Создает ExamResponse с названием из exam_type и информацией о создателе"""
        created_by_name = None
        if hasattr(obj, 'created_by') and obj.created_by:
            created_by_name = obj.created_by.teacher_name or obj.created_by.username

        data = {
            'id': obj.id,
            'exam_type_id': obj.exam_type_id,
            'id_student': obj.id_student,
            'subject': obj.subject,
            'answer': obj.answer,
            'comment': obj.comment,
            'name': obj.exam_type.name if obj.exam_type else None,
            'created_by_id': obj.created_by_id if hasattr(obj, 'created_by_id') else None,
            'created_by_name': created_by_name
        }
        return cls(**data)

class ExamWithStudentResponse(ExamResponse):
    student: StudentResponse


# ==== ТИПЫ ЭКЗАМЕНОВ ====

class ExamTypeBase(BaseModel):
    name: str
    group_id: Optional[int] = None
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

class PublicStudentResultsResponse(BaseModel):
    """Публичные результаты студента без чувствительных данных"""
    fio: str
    exams: List[ExamResponse] = []

    class Config:
        from_attributes = True

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
    school: Optional[str] = None  # "Байкальская" или "Лермонтова" для school_admin

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
    school: Optional[str] = None


    class Config:
        from_attributes = True  # Для работы с ORM объектами SQLAlchemy

# Для обновления сотрудника
class EmployeeUpdate(BaseModel):
    username: Optional[str] = None
    password: Optional[str] = None
    teacher_name: Optional[str] = None
    school: Optional[str] = None

    @field_validator('password')
    @classmethod
    def validate_password(cls, v):
        if v is not None and len(v) < 6:
            raise ValueError('Пароль должен быть не менее 6 символов')
        return v

# Для аутентификации
class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"

# Для ответа при логине
class LoginResponse(BaseModel):
    access_token: str
    role: str
    teacher_name: str
    school: Optional[str] = None
    employee_id: int

# ==== СХЕМЫ ДЛЯ ТЕЛЕГРАМ-БОТА ====

class ExamRegistrationCreate(BaseModel):
    student_id: int
    subject: str
    exam_date: str  # Дата в формате "YYYY-MM-DD"
    exam_time: str  # "9:00" или "12:00"
    school: Optional[str] = None  # "Байкальская" или "Лермонтова"

class ExamRegistrationResponse(BaseModel):
    id: int
    student_id: int
    subject: str
    exam_date: str
    exam_time: str
    school: Optional[str] = None
    created_at: str
    confirmed: bool
    confirmed_at: Optional[str] = None
    attended: bool = False
    submitted_work: bool = False
    
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
    school: Optional[str] = None
    created_at: str
    confirmed: bool
    confirmed_at: Optional[str] = None
    attended: bool = False
    submitted_work: bool = False
    
    class Config:
        from_attributes = True

class ExamRegistrationUpdate(BaseModel):
    """Обновление записи на экзамен"""
    attended: Optional[bool] = None
    submitted_work: Optional[bool] = None
    confirmed: Optional[bool] = None


# ==== СХЕМЫ ДЛЯ ПРОБНИКА ====

class ProbnikDateItem(BaseModel):
    label: str  # "Понедельник 5.01.26"
    date: str   # "2026-01-05"
    times: Optional[List[str]] = None  # ["9:00", "12:00"] - время для этого дня

class ProbnikCreate(BaseModel):
    name: str
    is_active: bool = False
    slots_baikalskaya: Optional[Dict[str, int]] = None  # {"9:00": 45, "12:00": 45}
    slots_lermontova: Optional[Dict[str, int]] = None
    exam_dates: Optional[List[ProbnikDateItem]] = None
    exam_times: Optional[List[str]] = None  # ["9:00", "12:00"]
    # Отдельные дни и время для каждого филиала
    exam_dates_baikalskaya: Optional[List[ProbnikDateItem]] = None
    exam_dates_lermontova: Optional[List[ProbnikDateItem]] = None
    exam_times_baikalskaya: Optional[List[str]] = None
    exam_times_lermontova: Optional[List[str]] = None
    max_registrations: Optional[int] = 4  # Максимальное количество записей на одного ученика

class ProbnikUpdate(BaseModel):
    name: Optional[str] = None
    is_active: Optional[bool] = None
    slots_baikalskaya: Optional[Dict[str, int]] = None
    slots_lermontova: Optional[Dict[str, int]] = None
    exam_dates: Optional[List[ProbnikDateItem]] = None
    exam_times: Optional[List[str]] = None
    # Отдельные дни и время для каждого филиала
    exam_dates_baikalskaya: Optional[List[ProbnikDateItem]] = None
    exam_dates_lermontova: Optional[List[ProbnikDateItem]] = None
    exam_times_baikalskaya: Optional[List[str]] = None
    exam_times_lermontova: Optional[List[str]] = None
    max_registrations: Optional[int] = None

class ProbnikResponse(BaseModel):
    id: int
    name: str
    is_active: bool
    created_at: Optional[str] = None
    slots_baikalskaya: Optional[Dict[str, int]] = None
    slots_lermontova: Optional[Dict[str, int]] = None
    exam_dates: Optional[List[ProbnikDateItem]] = None
    exam_times: Optional[List[str]] = None
    # Отдельные дни и время для каждого филиала
    exam_dates_baikalskaya: Optional[List[ProbnikDateItem]] = None
    exam_dates_lermontova: Optional[List[ProbnikDateItem]] = None
    exam_times_baikalskaya: Optional[List[str]] = None
    exam_times_lermontova: Optional[List[str]] = None
    max_registrations: Optional[int] = 4

    class Config:
        from_attributes = True


# ==== СХЕМЫ ДЛЯ ПРЕДМЕТОВ ====

class TopicItem(BaseModel):
    """Тема для конкретного задания"""
    task_number: int
    topic: str

class GradeScaleItem(BaseModel):
    """Диапазон баллов для оценки (ОГЭ)"""
    grade: int  # Оценка: 2, 3, 4, 5
    min: int    # Минимальный первичный балл
    max: int    # Максимальный первичный балл

class SubjectBase(BaseModel):
    code: str
    name: str
    exam_type: str  # ЕГЭ или ОГЭ
    tasks_count: int
    max_per_task: List[int]
    primary_to_secondary_scale: Optional[List[int]] = None  # Для ЕГЭ
    grade_scale: Optional[List[GradeScaleItem]] = None      # Для ОГЭ
    special_config: Optional[Dict] = None
    topics: Optional[List[TopicItem]] = None
    is_active: Optional[bool] = True

    @field_validator('exam_type')
    @classmethod
    def validate_exam_type(cls, v):
        if v not in ['ЕГЭ', 'ОГЭ']:
            raise ValueError('Тип экзамена должен быть: ЕГЭ или ОГЭ')
        return v

    @field_validator('max_per_task')
    @classmethod
    def validate_max_per_task(cls, v, info):
        # Проверяем, что длина массива совпадает с tasks_count (если tasks_count уже установлен)
        # Примечание: в Pydantic v2 используется info.data вместо values
        return v

class SubjectCreate(SubjectBase):
    pass

class SubjectUpdate(BaseModel):
    code: Optional[str] = None
    name: Optional[str] = None
    exam_type: Optional[str] = None
    tasks_count: Optional[int] = None
    max_per_task: Optional[List[int]] = None
    primary_to_secondary_scale: Optional[List[int]] = None  # Для ЕГЭ
    grade_scale: Optional[List[GradeScaleItem]] = None      # Для ОГЭ
    special_config: Optional[Dict] = None
    topics: Optional[List[TopicItem]] = None
    is_active: Optional[bool] = None

    @field_validator('exam_type')
    @classmethod
    def validate_exam_type(cls, v):
        if v is not None and v not in ['ЕГЭ', 'ОГЭ']:
            raise ValueError('Тип экзамена должен быть: ЕГЭ или ОГЭ')
        return v

class SubjectResponse(SubjectBase):
    id: int
    created_at: Optional[str] = None
    updated_at: Optional[str] = None

    class Config:
        from_attributes = True


# ==== СХЕМЫ ДЛЯ РАБОЧИХ СЕССИЙ ====

class WorkSessionCreate(BaseModel):
    """Создание рабочей сессии (только start_time)"""
    pass  # employee_id будет браться из токена

class WorkSessionUpdate(BaseModel):
    """Обновление рабочей сессии (завершение)"""
    pass  # end_time и duration_minutes рассчитываются автоматически

class WorkSessionResponse(BaseModel):
    id: int
    employee_id: int
    employee_name: Optional[str] = None  # Имя сотрудника
    start_time: str
    end_time: Optional[str] = None
    duration_minutes: Optional[int] = None

    class Config:
        from_attributes = True


# ==== СХЕМЫ ДЛЯ ЗАДАЧ ====

class LinkedStudent(BaseModel):
    id: int
    fio: str
    phone: Optional[str] = None


class TaskCreate(BaseModel):
    """Создание задачи"""
    title: str
    description: Optional[str] = None
    deadline: Optional[str] = None
    deadline_type: Optional[str] = None  # urgent, today, tomorrow, custom
    assigned_to_id: int
    linked_students: Optional[List[LinkedStudent]] = None

class TaskUpdate(BaseModel):
    """Обновление задачи"""
    title: Optional[str] = None
    description: Optional[str] = None
    deadline: Optional[str] = None
    status: Optional[str] = None  # new, in_progress, completed
    assigned_to_id: Optional[int] = None

    @field_validator('status')
    @classmethod
    def validate_status(cls, v):
        if v is not None and v not in ['new', 'in_progress', 'completed']:
            raise ValueError('Статус должен быть: new, in_progress или completed')
        return v

class TaskResponse(BaseModel):
    id: int
    title: str
    description: Optional[str] = None
    deadline: Optional[str] = None
    deadline_type: Optional[str] = None
    status: str
    linked_students: Optional[List[LinkedStudent]] = None
    created_by_id: int
    created_by_name: Optional[str] = None
    assigned_to_id: int
    assigned_to_name: Optional[str] = None
    created_at: str
    updated_at: str
    completed_at: Optional[str] = None

    class Config:
        from_attributes = True


# ==== СХЕМЫ ДЛЯ ОТЧЕТОВ ====

class LeadsData(BaseModel):
    """Данные о лидах"""
    calls: int = 0
    social: int = 0
    website: int = 0

class MoneyData(BaseModel):
    """Данные о деньгах"""
    cash: int = 0
    mobile_bank: int = 0
    non_cash: int = 0

class ReportUpdate(BaseModel):
    """Обновление отчета (все поля опциональны)"""
    report_date: Optional[str] = None
    work_start_time: Optional[str] = None
    work_end_time: Optional[str] = None
    leads: Optional[LeadsData] = None
    trial_scheduled: Optional[int] = None
    trial_attended: Optional[int] = None
    notified_tomorrow: Optional[str] = None
    cancellations: Optional[str] = None
    churn: Optional[str] = None
    money: Optional[MoneyData] = None
    water: Optional[str] = None
    supplies_needed: Optional[str] = None
    comments: Optional[str] = None


class ReportCreate(BaseModel):
    """Создание отчета"""
    report_date: str  # Формат: "YYYY-MM-DD"
    work_start_time: Optional[str] = None  # ISO строка
    work_end_time: Optional[str] = None    # ISO строка

    # Лиды
    leads: Optional[LeadsData] = None

    # Пробные занятия
    trial_scheduled: int = 0
    trial_attended: int = 0
    notified_tomorrow: str = ""  # да/нет

    # Переносы и отмены
    cancellations: str = ""

    # Отток
    churn: str = ""

    # Деньги
    money: Optional[MoneyData] = None

    # Хозяйственные вопросы
    water: str = ""
    supplies_needed: str = ""

    # Комментарии
    comments: str = ""

class ReportResponse(BaseModel):
    id: int
    employee_id: int
    employee_name: Optional[str] = None
    report_date: str
    created_at: str
    work_start_time: Optional[str] = None
    work_end_time: Optional[str] = None
    task_count: int = 0  # Активных задач (если онлайн) или закрытых за день (если завершён)

    # Структурированные данные
    leads: Optional[LeadsData] = None
    trial_scheduled: int = 0
    trial_attended: int = 0
    notified_tomorrow: str = ""
    cancellations: str = ""
    churn: str = ""
    money: Optional[MoneyData] = None
    water: str = ""
    supplies_needed: str = ""
    comments: str = ""

    class Config:
        from_attributes = True


# ==== СХЕМЫ ДЛЯ УРОКОВ ====

class AttendanceData(BaseModel):
    """Данные посещаемости одного студента на уроке"""
    student_id: int
    attendance_status: str = "present"  # present, trial, trial_absent, excused, absent
    grade_value: Optional[int] = None
    homework_grade_value: Optional[int] = None
    comment: Optional[str] = None


class AttendanceResponse(BaseModel):
    """Ответ с информацией о посещаемости студента"""
    id: int
    student_id: int
    student_fio: Optional[str] = None
    attendance_status: str
    grade_value: Optional[int] = None
    homework_grade_value: Optional[int] = None
    comment: Optional[str] = None

    class Config:
        from_attributes = True


class LessonBase(BaseModel):
    """Базовые поля урока"""
    group_id: int
    lesson_date: str  # ISO datetime
    duration_minutes: int = 90
    topic: Optional[str] = None
    homework: Optional[str] = None
    grading_mode: str = "numeric"  # numeric или tasks
    total_tasks: Optional[int] = None
    homework_total_tasks: Optional[int] = None


class LessonCreate(LessonBase):
    """Создание урока"""
    auto_generated: bool = False


class LessonUpdate(BaseModel):
    """Обновление урока"""
    lesson_date: Optional[str] = None
    duration_minutes: Optional[int] = None
    topic: Optional[str] = None
    homework: Optional[str] = None
    grading_mode: Optional[str] = None
    total_tasks: Optional[int] = None
    homework_total_tasks: Optional[int] = None


class LessonResponse(BaseModel):
    """Ответ с информацией об уроке"""
    id: int
    group_id: int
    group_name: Optional[str] = None
    lesson_date: str
    duration_minutes: int
    topic: Optional[str] = None
    homework: Optional[str] = None
    grading_mode: str
    total_tasks: Optional[int] = None
    homework_total_tasks: Optional[int] = None
    auto_generated: bool
    is_cancelled: bool
    cancellation_reason: Optional[str] = None
    is_completed: bool
    completed_at: Optional[str] = None
    completed_by_id: Optional[int] = None
    completed_by_name: Optional[str] = None
    created_at: str
    updated_at: str

    class Config:
        from_attributes = True


class LessonFillData(BaseModel):
    """Данные для заполнения урока (посещаемость всех студентов)"""
    attendances: List[AttendanceData]


class LessonDetailResponse(LessonResponse):
    """Детальный ответ об уроке с посещаемостью"""
    attendances: List[AttendanceResponse] = []

    class Config:
        from_attributes = True
