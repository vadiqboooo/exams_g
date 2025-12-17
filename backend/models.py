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
    
    student = relationship("Student", back_populates="exams")
    exam_type = relationship("ExamType", back_populates="exams")

class Employee(Base):
    __tablename__ = "employees"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True)
    password_hash = Column(String)
    role = Column(String)  # "admin" or "teacher"
    teacher_name = Column(String, nullable=True)
    
    groups = relationship("StudyGroup", back_populates="teacher")

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
    
    registrations = relationship("ExamRegistration", back_populates="probnik") 