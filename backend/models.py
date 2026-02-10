from sqlalchemy import Column, Integer, String, ForeignKey, Table, Text, JSON, DateTime, Boolean
from sqlalchemy.orm import relationship
from sqlalchemy.ext.declarative import declarative_base
from datetime import datetime

Base = declarative_base()

# Связующая таблица: студент может быть в нескольких группах
group_student_association = Table(
    'group_student',
    Base.metadata,
    Column('group_id', Integer, ForeignKey('study_group.id'), primary_key=True),
    Column('student_id', Integer, ForeignKey('student.id'), primary_key=True)
)

class StudyGroup(Base):
    __tablename__ = 'study_group'
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)  # Оставляем для обратной совместимости
    
    # Новые поля
    school = Column(String(100), nullable=True)  # "Байкальская" или "Лермонтова"
    exam_type = Column(String(20), nullable=True)  # "ЕГЭ" или "ОГЭ"
    subject = Column(String(100), nullable=True)  # "Русский язык", "Математика" и т.д.
    teacher_id = Column(Integer, ForeignKey('employees.id'), nullable=False)
    
    # Расписание в формате JSON
    # Пример: {"monday": "10:00-12:00", "wednesday": "14:00-16:00", ...}
    schedule = Column(JSON, nullable=True)
    
    students = relationship("Student", secondary=group_student_association, back_populates="groups")
    teacher = relationship("Employee", back_populates="groups")
    exam_types = relationship("ExamType", back_populates="group")
    lessons = relationship("Lesson", back_populates="group", cascade="all, delete-orphan")

class Student(Base):
    __tablename__ = 'student'
    
    id = Column(Integer, primary_key=True, index=True)
    fio = Column(String(200), nullable=False)
    phone = Column(String(20))
    
    # Новые поля для администратора
    admin_comment = Column(Text, nullable=True)
    parent_contact_status = Column(String(50), nullable=True)  # 'informed', 'callback', 'no_answer'
    
    # Поля для телеграм-бота
    user_id = Column(Integer, nullable=True, index=True)  # Telegram user ID
    class_num = Column(Integer, nullable=True)  # Класс ученика (9, 10, 11)
    confirmed_at = Column(DateTime, nullable=True)  # Время подтверждения регистрации в боте

    # Уникальный токен для доступа к результатам без авторизации
    access_token = Column(String(64), nullable=True, unique=True, index=True)

    exams = relationship("Exam", back_populates="student")
    groups = relationship("StudyGroup", secondary=group_student_association, back_populates="students")
    exam_registrations = relationship("ExamRegistration", back_populates="student")


class ExamType(Base):
    __tablename__ = 'exam_types'

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)  # Убрали unique, так как для разных групп могут быть одинаковые названия
    group_id = Column(Integer, ForeignKey('study_group.id'), nullable=False)
    completed_tasks = Column(JSON, nullable=True)  # Массив номеров пройденных заданий, например [1, 2, 3, 5, 7]

    exams = relationship("Exam", back_populates="exam_type")
    group = relationship("StudyGroup", back_populates="exam_types")

class Exam(Base):
    __tablename__ = 'exam'

    id = Column(Integer, primary_key=True, index=True)
    exam_type_id = Column(Integer, ForeignKey('exam_types.id'), nullable=False)  # Связь с типом экзамена (название берется оттуда)
    id_student = Column(Integer, ForeignKey('student.id'), nullable=False)
    subject = Column(String(100), nullable=False)
    answer = Column(Text)
    comment = Column(Text)
    created_by_id = Column(Integer, ForeignKey('employees.id'), nullable=True)  # Кто создал результат экзамена

    student = relationship("Student", back_populates="exams")
    exam_type = relationship("ExamType", back_populates="exams")
    created_by = relationship("Employee")

class Employee(Base):
    __tablename__ = "employees"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True)
    password_hash = Column(String)
    role = Column(String)  # "owner", "school_admin" or "teacher"
    teacher_name = Column(String, nullable=True)
    school = Column(String(100), nullable=True)  # "Байкальская" или "Лермонтова" для school_admin

    groups = relationship("StudyGroup", back_populates="teacher")
    work_sessions = relationship("WorkSession", back_populates="employee")
    reports = relationship("Report", back_populates="employee")

class ExamRegistration(Base):
    """Запись на зимний пробник"""
    __tablename__ = 'exam_registration'
    
    id = Column(Integer, primary_key=True, index=True)
    student_id = Column(Integer, ForeignKey('student.id'), nullable=False)
    subject = Column(String(100), nullable=False)  # Предмет экзамена
    exam_date = Column(DateTime, nullable=False)  # Дата и время экзамена
    exam_time = Column(String(10), nullable=False)  # "9:00" или "12:00"
    school = Column(String(100), nullable=True)  # "Байкальская" или "Лермонтова"
    created_at = Column(DateTime, default=datetime.utcnow)
    confirmed = Column(Boolean, default=False)  # Подтверждение участия
    confirmed_at = Column(DateTime, nullable=True)  # Когда подтвердил участие
    attended = Column(Boolean, default=False)  # Пришел на экзамен
    submitted_work = Column(Boolean, default=False)  # Сдал работу
    probnik_id = Column(Integer, ForeignKey('probnik.id'), nullable=True)  # Связь с пробником
    
    student = relationship("Student", back_populates="exam_registrations")
    probnik = relationship("Probnik", back_populates="registrations")


class Probnik(Base):
    """Настройки пробника (экзамена для записи через телеграм)"""
    __tablename__ = 'probnik'

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(200), nullable=False)  # Название пробника
    is_active = Column(Boolean, default=False)  # Открыта ли запись
    created_at = Column(DateTime, default=datetime.utcnow)

    # Места на школах в JSON формате: {"9:00": 45, "12:00": 45}
    slots_baikalskaya = Column(JSON, nullable=True)
    slots_lermontova = Column(JSON, nullable=True)

    # Дни проведения в JSON: [{"label": "Понедельник 5.01.26", "date": "2026-01-05"}, ...]
    exam_dates = Column(JSON, nullable=True)

    # Время проведения: ["9:00", "12:00"]
    exam_times = Column(JSON, nullable=True)

    # Отдельные дни для каждого филиала
    exam_dates_baikalskaya = Column(JSON, nullable=True)
    exam_dates_lermontova = Column(JSON, nullable=True)

    # Отдельное время для каждого филиала
    exam_times_baikalskaya = Column(JSON, nullable=True)
    exam_times_lermontova = Column(JSON, nullable=True)

    # Максимальное количество записей на одного ученика
    max_registrations = Column(Integer, default=4, nullable=True)

    registrations = relationship("ExamRegistration", back_populates="probnik")


class Subject(Base):
    """Предметы с настройками (количество заданий, баллы, темы)"""
    __tablename__ = 'subjects'

    id = Column(Integer, primary_key=True, index=True)
    code = Column(String(50), unique=True, nullable=False, index=True)  # rus, math_profile, etc.
    name = Column(String(200), nullable=False)  # Русский язык, Математика (профиль)
    exam_type = Column(String(20), nullable=False)  # ЕГЭ или ОГЭ
    tasks_count = Column(Integer, nullable=False)  # Количество заданий
    max_per_task = Column(JSON, nullable=False)  # Массив максимальных баллов: [1,1,2,3,...]

    # Таблица перевода первичных баллов в тестовые (только для ЕГЭ)
    # Формат: [0, 3, 5, 8, ...] где индекс - первичный балл, значение - тестовый
    primary_to_secondary_scale = Column(JSON, nullable=True)

    # Таблица перевода первичных баллов в оценку (только для ОГЭ)
    # Формат: [{"grade": 2, "min": 0, "max": 10}, {"grade": 3, "min": 11, "max": 15}, ...]
    grade_scale = Column(JSON, nullable=True)

    # Специальная конфигурация для предметов с парными заданиями (например, infa_9)
    # Формат: {"type": "paired", "pairs": [[12, 13]], "special_task": 14}
    special_config = Column(JSON, nullable=True)

    # Темы, которые проходятся в предмете
    # Формат: [{"task_number": 1, "topic": "Фонетика"}, {"task_number": 2, "topic": "Лексика"}, ...]
    topics = Column(JSON, nullable=True)

    is_active = Column(Boolean, default=True)  # Активен ли предмет
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class WorkSession(Base):
    """Рабочие сессии для учета времени school_admin"""
    __tablename__ = 'work_sessions'

    id = Column(Integer, primary_key=True, index=True)
    employee_id = Column(Integer, ForeignKey('employees.id'), nullable=False)
    start_time = Column(DateTime, nullable=False)
    end_time = Column(DateTime, nullable=True)
    duration_minutes = Column(Integer, nullable=True)

    employee = relationship("Employee", back_populates="work_sessions")


class Task(Base):
    """Задачи для school_admin от owner"""
    __tablename__ = 'tasks'

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(200), nullable=False)
    description = Column(Text, nullable=True)
    deadline = Column(DateTime, nullable=True)
    deadline_type = Column(String(20), nullable=True)  # urgent, today, tomorrow, custom
    status = Column(String(20), default='new')  # new, in_progress, completed
    linked_students = Column(JSON, nullable=True)  # [{id, fio, phone}]
    created_by_id = Column(Integer, ForeignKey('employees.id'), nullable=False)
    assigned_to_id = Column(Integer, ForeignKey('employees.id'), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    completed_at = Column(DateTime, nullable=True)

    created_by = relationship("Employee", foreign_keys=[created_by_id])
    assigned_to = relationship("Employee", foreign_keys=[assigned_to_id])


class Report(Base):
    """Отчеты от school_admin"""
    __tablename__ = 'reports'

    id = Column(Integer, primary_key=True, index=True)
    employee_id = Column(Integer, ForeignKey('employees.id'), nullable=False)
    report_date = Column(DateTime, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Структурированные данные в JSON
    leads = Column(JSON, nullable=True)  # {calls: 0, social: 0, website: 0}
    trial_scheduled = Column(Integer, default=0)
    trial_attended = Column(Integer, default=0)
    notified_tomorrow = Column(String(10), nullable=True)
    cancellations = Column(Text, nullable=True)
    churn = Column(Text, nullable=True)
    money = Column(JSON, nullable=True)  # {cash: 0, mobile_bank: 0, non_cash: 0}
    water = Column(String(200), nullable=True)
    supplies_needed = Column(Text, nullable=True)
    comments = Column(Text, nullable=True)

    # Время рабочего дня
    work_start_time = Column(DateTime, nullable=True)
    work_end_time = Column(DateTime, nullable=True)

    # Старое поле для обратной совместимости
    content = Column(Text, nullable=True)

    employee = relationship("Employee", back_populates="reports")


class Lesson(Base):
    """Уроки групп"""
    __tablename__ = 'lessons'

    id = Column(Integer, primary_key=True, index=True)
    group_id = Column(Integer, ForeignKey('study_group.id'), nullable=False)

    # Дата и время
    lesson_date = Column(DateTime, nullable=False, index=True)
    duration_minutes = Column(Integer, default=90)
    topic = Column(String(200), nullable=True)
    homework = Column(Text, nullable=True)

    # Режим оценивания
    grading_mode = Column(String(20), default='numeric')  # 'numeric' или 'tasks'
    total_tasks = Column(Integer, nullable=True)  # Для режима tasks
    homework_total_tasks = Column(Integer, nullable=True)

    # Статусы
    auto_generated = Column(Boolean, default=True)
    is_cancelled = Column(Boolean, default=False)
    cancellation_reason = Column(Text, nullable=True)
    is_completed = Column(Boolean, default=False)
    completed_at = Column(DateTime, nullable=True)
    completed_by_id = Column(Integer, ForeignKey('employees.id'), nullable=True)  # Кто провел урок

    # Метаданные
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    created_by_id = Column(Integer, ForeignKey('employees.id'), nullable=True)

    # Relationships
    group = relationship("StudyGroup", back_populates="lessons")
    attendances = relationship("LessonAttendance", back_populates="lesson", cascade="all, delete-orphan")
    created_by = relationship("Employee", foreign_keys=[created_by_id])
    completed_by = relationship("Employee", foreign_keys=[completed_by_id])


class LessonAttendance(Base):
    """Посещаемость студентов на уроках"""
    __tablename__ = 'lesson_attendance'

    id = Column(Integer, primary_key=True, index=True)
    lesson_id = Column(Integer, ForeignKey('lessons.id'), nullable=False)
    student_id = Column(Integer, ForeignKey('student.id'), nullable=False)

    # Статусы: present, trial, trial_absent, excused, absent
    attendance_status = Column(String(20), nullable=False, default='present')

    # Оценки (универсальное поле для числа или задач)
    grade_value = Column(Integer, nullable=True)
    homework_grade_value = Column(Integer, nullable=True)
    comment = Column(Text, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    lesson = relationship("Lesson", back_populates="attendances")
    student = relationship("Student") 