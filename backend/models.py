from sqlalchemy import Column, Integer, String, ForeignKey, Table, Text, JSON
from sqlalchemy.orm import relationship
from sqlalchemy.ext.declarative import declarative_base

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
    
    exams = relationship("Exam", back_populates="student")
    groups = relationship("StudyGroup", secondary=group_student_association, back_populates="students")


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