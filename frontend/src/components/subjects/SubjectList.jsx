import React from 'react';
import DropdownMenu from '../common/DropdownMenu';
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
                <span className={`status-badge ${subject.is_active ? 'active' : 'inactive'}`}>
                  {subject.is_active ? (
                    <>
                      <svg className="status-icon" width="16" height="16" viewBox="0 0 16 16" fill="none">
                        <circle cx="8" cy="8" r="7" fill="#10b981" />
                        <path d="M5 8l2 2 4-4" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                      Активен
                    </>
                  ) : (
                    <>
                      <svg className="status-icon" width="16" height="16" viewBox="0 0 16 16" fill="none">
                        <circle cx="8" cy="8" r="7" fill="#ef4444" />
                        <path d="M8 4v4l2 2" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                      Неактивен
                    </>
                  )}
                </span>
              </td>
              <td className="actions-cell">
                <DropdownMenu
                  items={[
                    {
                      label: 'Редактировать',
                      onClick: () => onEdit(subject)
                    },
                    {
                      label: subject.is_active ? 'Деактивировать' : 'Активировать',
                      onClick: () => onToggleActive(subject)
                    },
                    {
                      separator: true
                    },
                    {
                      label: 'Удалить',
                      variant: 'destructive',
                      onClick: () => onDelete(subject.id)
                    }
                  ]}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default SubjectList;
