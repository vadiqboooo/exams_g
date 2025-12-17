import React from 'react';

const StudentCard = ({ student, onEdit, onDelete }) => {
  return (
    <div className="student-card">
      <div className="student-info">
        <h3>{student.fio}</h3>
        {student.phone && <p className="phone">📱 {student.phone}</p>}
        {student.class_num && <p className="class-num">Класс: {student.class_num}</p>}
        {student.schools && student.schools.length > 0 && (
          <p className="schools">🏫 Школа: {student.schools.join(', ')}</p>
        )}
        <p className="student-id">ID: {student.id}</p>
      </div>
      
      <div className="student-actions">
        <button onClick={onEdit} className="btn btn-secondary">
          ✏️ Редактировать
        </button>
        <button onClick={onDelete} className="btn btn-danger">
          🗑️ Удалить
        </button>
      </div>
    </div>
  );
};

export default StudentCard;