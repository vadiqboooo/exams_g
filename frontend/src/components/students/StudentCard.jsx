import React, { useState } from 'react';

const StudentCard = ({ student, onEdit, onDelete, showNotification }) => {
  const [copied, setCopied] = useState(false);

  const copyResultsLink = () => {
    if (!student.access_token) {
      showNotification?.('У студента нет токена доступа. Регенерируйте токен через редактирование.', 'error');
      return;
    }

    const resultsUrl = `${window.location.origin}/results/${student.access_token}`;

    navigator.clipboard.writeText(resultsUrl).then(() => {
      setCopied(true);
      showNotification?.('Ссылка скопирована в буфер обмена', 'success');

      setTimeout(() => setCopied(false), 2000);
    }).catch(() => {
      showNotification?.('Не удалось скопировать ссылку', 'error');
    });
  };

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
        <button
          onClick={copyResultsLink}
          className="btn btn-primary"
          title="Скопировать ссылку на результаты"
        >
          {copied ? '✓ Скопировано' : '🔗 Ссылка на результаты'}
        </button>
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