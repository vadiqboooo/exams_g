import { useState } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';

const LessonsList = ({ lessons, onCancel, onFill, showNotification, isPast = false }) => {
  const [cancelingLesson, setCancelingLesson] = useState(null);
  const [cancelReason, setCancelReason] = useState('');

  const formatDateTime = (dateStr) => {
    const date = new Date(dateStr);
    return date.toLocaleString('ru-RU', {
      weekday: 'short',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatDate = (dateStr) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  const formatTime = (dateStr) => {
    const date = new Date(dateStr);
    return date.toLocaleTimeString('ru-RU', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const handleCancelClick = (lesson) => {
    setCancelingLesson(lesson);
    setCancelReason('');
  };

  const handleCancelConfirm = () => {
    if (onCancel && cancelingLesson) {
      onCancel(cancelingLesson.id, cancelReason);
      setCancelingLesson(null);
      setCancelReason('');
    }
  };

  if (lessons.length === 0) {
    return (
      <div className="empty-state">
        <div className="empty-icon">📚</div>
        <h3>{isPast ? 'Нет прошедших уроков' : 'Нет предстоящих уроков'}</h3>
        <p className="text-muted">
          {isPast ? 'История уроков пуста' : 'Уроки будут отображаться здесь'}
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="table-container">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Дата</TableHead>
              <TableHead>Время</TableHead>
              <TableHead>Группа</TableHead>
              <TableHead>Тема</TableHead>
              <TableHead>Длительность</TableHead>
              <TableHead>Статус</TableHead>
              <TableHead className="text-right">Действия</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {lessons.map(lesson => (
              <TableRow key={lesson.id} className="lesson-row">
                <TableCell className="font-medium">
                  {formatDate(lesson.lesson_date)}
                </TableCell>
                <TableCell>{formatTime(lesson.lesson_date)}</TableCell>
                <TableCell>
                  <div className="group-cell">
                    <span className="group-name">{lesson.group_name}</span>
                    {lesson.auto_generated && (
                      <span className="badge badge-secondary">Авто</span>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <span className="text-muted">
                    {lesson.topic || '—'}
                  </span>
                </TableCell>
                <TableCell>
                  <span className="text-muted">{lesson.duration_minutes} мин</span>
                </TableCell>
                <TableCell>
                  {lesson.is_completed ? (
                    <span className="badge badge-success">Проведен</span>
                  ) : (
                    <span className="badge badge-default">Не проведен</span>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  <div className="action-buttons">
                    <button
                      className="btn btn-sm btn-primary"
                      onClick={() => onFill(lesson)}
                    >
                      {lesson.is_completed ? 'Просмотр' : 'Провести'}
                    </button>
                    {!isPast && !lesson.is_completed && onCancel && (
                      <button
                        className="btn btn-sm btn-ghost"
                        onClick={() => handleCancelClick(lesson)}
                      >
                        Отменить
                      </button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {cancelingLesson && (
        <div className="modal-overlay" onClick={() => setCancelingLesson(null)}>
          <div className="modal-content modal-sm" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Отмена урока</h3>
            </div>
            <div className="modal-body">
              <p>Вы уверены, что хотите отменить урок?</p>
              <div className="lesson-info-box">
                <p><strong>{cancelingLesson.group_name}</strong></p>
                <p className="text-muted">{formatDateTime(cancelingLesson.lesson_date)}</p>
              </div>

              <div className="form-group">
                <label>Причина отмены (необязательно):</label>
                <textarea
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  placeholder="Укажите причину отмены урока..."
                  rows={3}
                  className="form-input"
                />
              </div>
            </div>
            <div className="modal-footer">
              <button
                className="btn btn-ghost"
                onClick={() => setCancelingLesson(null)}
              >
                Отмена
              </button>
              <button
                className="btn btn-destructive"
                onClick={handleCancelConfirm}
              >
                Отменить урок
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default LessonsList;
