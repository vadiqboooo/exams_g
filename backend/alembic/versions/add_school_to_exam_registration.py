"""add school field to exam registration

Revision ID: add_school_to_registration
Revises: add_telegram_fields
Create Date: 2025-01-27 15:00:00
"""
from alembic import op
import sqlalchemy as sa


revision = 'add_school_to_registration'
down_revision = 'add_telegram_fields'
branch_labels = None
depends_on = None


def upgrade():
    connection = op.get_bind()
    inspector = sa.inspect(connection)
    
    existing_tables = inspector.get_table_names()
    
    # Добавляем поле school в таблицу exam_registration
    if 'exam_registration' in existing_tables:
        columns = [col['name'] for col in inspector.get_columns('exam_registration')]
        
        if 'school' not in columns:
            op.add_column('exam_registration', sa.Column('school', sa.String(length=100), nullable=True))


def downgrade():
    # Удаляем поле school из таблицы exam_registration
    try:
        op.drop_column('exam_registration', 'school')
    except Exception:
        pass




