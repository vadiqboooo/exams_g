"""add exam_types table and link exams

Revision ID: add_exam_types
Revises: add_teacher_id
Create Date: 2025-12-08 00:01:00
"""
from alembic import op
import sqlalchemy as sa


revision = 'add_exam_types'
down_revision = 'add_teacher_id'
branch_labels = None
depends_on = None


def upgrade():
    connection = op.get_bind()
    inspector = sa.inspect(connection)

    existing_tables = inspector.get_table_names()

    # 1. Create exam_types table if missing (без unique на name, будет составной индекс)
    if 'exam_types' not in existing_tables:
        op.create_table(
            'exam_types',
            sa.Column('id', sa.Integer(), primary_key=True, index=True),
            sa.Column('name', sa.String(100), nullable=False),  # Без unique, будет составной индекс
        )

    # 2. Add exam_type_id column to exam if missing
    exam_columns = [col['name'] for col in inspector.get_columns('exam')]
    if 'exam_type_id' not in exam_columns:
        with op.batch_alter_table('exam', schema=None) as batch_op:
            batch_op.add_column(sa.Column('exam_type_id', sa.Integer(), nullable=True))

    # 3. Backfill exam_types from existing exam names
    result = connection.execute(sa.text("SELECT name FROM exam_types"))
    existing_type_names = {row[0] for row in result.fetchall()}

    result = connection.execute(sa.text("SELECT DISTINCT name FROM exam WHERE name IS NOT NULL"))
    exam_names = [row[0] for row in result.fetchall()]

    for name in exam_names:
        if name and name not in existing_type_names:
            connection.execute(sa.text("INSERT INTO exam_types (name) VALUES (:name)"), {"name": name})
    connection.commit()

    # 4. Update exam rows with exam_type_id
    connection.execute(sa.text("""
        UPDATE exam
        SET exam_type_id = (
            SELECT id FROM exam_types WHERE exam_types.name = exam.name
        )
        WHERE exam_type_id IS NULL
    """))
    connection.commit()

    # 5. Enforce NOT NULL and create FK
    with op.batch_alter_table('exam', schema=None) as batch_op:
        batch_op.alter_column('exam_type_id', existing_type=sa.Integer(), nullable=False)
        # protect against duplicate FK creation
        batch_op.create_foreign_key(
            'fk_exam_exam_type',
            'exam_types',
            ['exam_type_id'],
            ['id']
        )


def downgrade():
    # Remove FK and column
    with op.batch_alter_table('exam', schema=None) as batch_op:
        try:
            batch_op.drop_constraint('fk_exam_exam_type', type_='foreignkey')
        except Exception:
            pass
        batch_op.drop_column('exam_type_id')

    # Drop exam_types table
    op.drop_table('exam_types')

