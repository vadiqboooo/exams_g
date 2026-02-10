"""add lessons tables

Revision ID: add_lessons_tables
Revises: add_grade_scale_to_subjects
Create Date: 2026-02-09

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'add_lessons_tables'
down_revision = 'add_grade_scale'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Создаем таблицу lessons
    op.create_table(
        'lessons',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('group_id', sa.Integer(), nullable=False),
        sa.Column('lesson_date', sa.DateTime(), nullable=False),
        sa.Column('duration_minutes', sa.Integer(), nullable=True, default=90),
        sa.Column('topic', sa.String(200), nullable=True),
        sa.Column('grading_mode', sa.String(20), nullable=True, default='numeric'),
        sa.Column('total_tasks', sa.Integer(), nullable=True),
        sa.Column('homework_total_tasks', sa.Integer(), nullable=True),
        sa.Column('auto_generated', sa.Boolean(), nullable=True, default=True),
        sa.Column('is_cancelled', sa.Boolean(), nullable=True, default=False),
        sa.Column('cancellation_reason', sa.Text(), nullable=True),
        sa.Column('is_completed', sa.Boolean(), nullable=True, default=False),
        sa.Column('completed_at', sa.DateTime(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.Column('created_by_id', sa.Integer(), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['group_id'], ['study_group.id'], ),
        sa.ForeignKeyConstraint(['created_by_id'], ['employees.id'], )
    )

    # Создаем индексы для lessons
    op.create_index('ix_lessons_id', 'lessons', ['id'])
    op.create_index('ix_lessons_lesson_date', 'lessons', ['lesson_date'])

    # Создаем таблицу lesson_attendance
    op.create_table(
        'lesson_attendance',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('lesson_id', sa.Integer(), nullable=False),
        sa.Column('student_id', sa.Integer(), nullable=False),
        sa.Column('attendance_status', sa.String(20), nullable=False, default='present'),
        sa.Column('grade_value', sa.Integer(), nullable=True),
        sa.Column('homework_grade_value', sa.Integer(), nullable=True),
        sa.Column('comment', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['lesson_id'], ['lessons.id'], ),
        sa.ForeignKeyConstraint(['student_id'], ['student.id'], )
    )

    # Создаем индексы для lesson_attendance
    op.create_index('ix_lesson_attendance_id', 'lesson_attendance', ['id'])
    op.create_index('ix_lesson_attendance_lesson_student', 'lesson_attendance', ['lesson_id', 'student_id'], unique=True)


def downgrade() -> None:
    # Удаляем lesson_attendance
    op.drop_index('ix_lesson_attendance_lesson_student', table_name='lesson_attendance')
    op.drop_index('ix_lesson_attendance_id', table_name='lesson_attendance')
    op.drop_table('lesson_attendance')

    # Удаляем lessons
    op.drop_index('ix_lessons_lesson_date', table_name='lessons')
    op.drop_index('ix_lessons_id', table_name='lessons')
    op.drop_table('lessons')
