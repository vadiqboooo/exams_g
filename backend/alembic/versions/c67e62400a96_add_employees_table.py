"""add employees table"""

from alembic import op
import sqlalchemy as sa


revision = 'add_employees_table'
down_revision = None  # или поставь предыдущий revision ID
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'employees',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('username', sa.String(), unique=True, index=True),
        sa.Column('password_hash', sa.String()),
        sa.Column('role', sa.String()),
        sa.Column('teacher_name', sa.String(), nullable=True),
    )


def downgrade():
    op.drop_table('employees')
