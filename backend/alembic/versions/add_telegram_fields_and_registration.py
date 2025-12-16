"""add telegram fields and exam registration table

Revision ID: add_telegram_fields
Revises: add_completed_tasks_to_exam_types
Create Date: 2025-01-27 12:00:00
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import DateTime


revision = 'add_telegram_fields'
down_revision = 'add_completed_tasks_to_exam_types'
branch_labels = None
depends_on = None


def upgrade():
    connection = op.get_bind()
    inspector = sa.inspect(connection)
    
    existing_tables = inspector.get_table_names()
    
    # Добавляем поля в таблицу student
    if 'student' in existing_tables:
        columns = [col['name'] for col in inspector.get_columns('student')]
        
        if 'user_id' not in columns:
            op.add_column('student', sa.Column('user_id', sa.Integer(), nullable=True))
            # Создаем индекс для user_id
            op.create_index('ix_student_user_id', 'student', ['user_id'])
        
        if 'class_num' not in columns:
            op.add_column('student', sa.Column('class_num', sa.Integer(), nullable=True))
        
        if 'confirmed_at' not in columns:
            op.add_column('student', sa.Column('confirmed_at', sa.DateTime(), nullable=True))
    
    # Создаем таблицу exam_registration
    if 'exam_registration' not in existing_tables:
        op.create_table(
            'exam_registration',
            sa.Column('id', sa.Integer(), nullable=False),
            sa.Column('student_id', sa.Integer(), nullable=False),
            sa.Column('subject', sa.String(length=100), nullable=False),
            sa.Column('exam_date', sa.DateTime(), nullable=False),
            sa.Column('exam_time', sa.String(length=10), nullable=False),
            sa.Column('created_at', sa.DateTime(), nullable=True),
            sa.Column('confirmed', sa.Boolean(), nullable=True),
            sa.Column('confirmed_at', sa.DateTime(), nullable=True),
            sa.ForeignKeyConstraint(['student_id'], ['student.id'], ),
            sa.PrimaryKeyConstraint('id')
        )
        op.create_index(op.f('ix_exam_registration_id'), 'exam_registration', ['id'], unique=False)


def downgrade():
    # Удаляем таблицу exam_registration
    try:
        op.drop_index(op.f('ix_exam_registration_id'), table_name='exam_registration')
        op.drop_table('exam_registration')
    except Exception:
        pass
    
    # Удаляем поля из таблицы student
    try:
        op.drop_index('ix_student_user_id', table_name='student')
        op.drop_column('student', 'user_id')
    except Exception:
        pass
    
    try:
        op.drop_column('student', 'class_num')
    except Exception:
        pass
    
    try:
        op.drop_column('student', 'confirmed_at')
    except Exception:
        pass

