import React from 'react';
import './SubjectList.css';

const SubjectList = ({ subjects, onEdit, onDelete, onToggleActive }) => {
  if (subjects.length === 0) {
    return (
      <div className="empty-state">
        <p>Нет предметов для отображения</p>
      </div>
    );
  }

  return (
    <div className="subject-list">
      <table className="subject-table">
        <thead>
          <tr>
            <th>Код</th>
            <th>Название</th>
            <th>Тип</th>
            <th>Заданий</th>
            <th>Темы</th>
            <th>Статус</th>
            <th>Действия</th>
          </tr>
        </thead>
        <tbody>
          {subjects.map(subject => (
            <tr key={subject.id} className={!subject.is_active ? 'inactive' : ''}>
              <td className="code-cell">{subject.code}</td>
              <td className="name-cell">{subject.name}</td>
              <td className="exam-type-cell">
                <span className={`exam-type-badge ${subject.exam_type === 'ЕГЭ' ? 'ege' : 'oge'}`}>
                  {subject.exam_type}
                </span>
              </td>
              <td className="tasks-cell">{subject.tasks_count}</td>
              <td className="topics-cell">
                {subject.topics && subject.topics.length > 0 ? (
                  <span className="topics-count">{subject.topics.length} тем</span>
                ) : (
                  <span className="no-topics">Нет тем</span>
                )}
              </td>
              <td className="status-cell">
                <button
                  onClick={() => onToggleActive(subject)}
                  className={`status-toggle ${subject.is_active ? 'active' : 'inactive'}`}
                >
                  {subject.is_active ? '✓ Активен' : '✗ Неактивен'}
                </button>
              </td>
              <td className="actions-cell">
                <button
                  onClick={() => onEdit(subject)}
                  className="btn-edit"
                  title="Редактировать"
                >
                  ✏️
                </button>
                <button
                  onClick={() => onDelete(subject.id)}
                  className="btn-delete"
                  title="Удалить"
                >
                  🗑️
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default SubjectList;
