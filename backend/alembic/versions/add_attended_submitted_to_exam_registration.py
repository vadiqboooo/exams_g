"""add attended and submitted_work fields to exam registration

Revision ID: add_attended_submitted
Revises: add_school_to_registration
Create Date: 2025-01-27 16:00:00
"""
from alembic import op
import sqlalchemy as sa


revision = 'add_attended_submitted'
down_revision = 'add_school_to_registration'
branch_labels = None
depends_on = None


def upgrade():
    connection = op.get_bind()
    inspector = sa.inspect(connection)
    
    existing_tables = inspector.get_table_names()
    
    # Добавляем поля attended и submitted_work в таблицу exam_registration
    if 'exam_registration' in existing_tables:
        columns = [col['name'] for col in inspector.get_columns('exam_registration')]
        
        if 'attended' not in columns:
            op.add_column('exam_registration', sa.Column('attended', sa.Boolean(), nullable=True, server_default='0'))
        
        if 'submitted_work' not in columns:
            op.add_column('exam_registration', sa.Column('submitted_work', sa.Boolean(), nullable=True, server_default='0'))


def downgrade():
    # Удаляем поля из таблицы exam_registration
    try:
        op.drop_column('exam_registration', 'attended')
    except Exception:
        pass
    
    try:
        op.drop_column('exam_registration', 'submitted_work')
    except Exception:
        pass





