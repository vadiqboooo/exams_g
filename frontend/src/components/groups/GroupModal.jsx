import React from 'react';
import Modal from '../common/Modal';

const GroupModal = ({ group, onClose, showNotification }) => {
  return (
    <Modal onClose={onClose} size="lg">
      <div className="group-modal">
        <div className="modal-header">
          <h2>{group.name}</h2>
          <button onClick={onClose} className="close-btn">×</button>
        </div>

        <div className="modal-content">
          <div className="group-details">
            <div className="detail-item">
              <strong>Преподаватель:</strong>
              <span>👨‍🏫 {group.teacher_name || group.teacher || 'Не указан'}</span>
            </div>
            
            {group.school && (
              <div className="detail-item">
                <strong>Школа:</strong>
                <span>🏫 {group.school}</span>
              </div>
            )}
            
            {group.subject && (
              <div className="detail-item">
                <strong>Предмет:</strong>
                <span>📖 {group.subject}</span>
              </div>
            )}
            
            {group.exam_type && (
              <div className="detail-item">
                <strong>Тип экзамена:</strong>
                <span>📝 {group.exam_type}</span>
              </div>
            )}
            
            {group.schedule && Object.keys(group.schedule).length > 0 && (
              <div className="detail-item">
                <strong>Расписание:</strong>
                <span>📅 {formatSchedule(group.schedule)}</span>
              </div>
            )}
          </div>

          <div className="students-section">
            <h3>Студенты группы ({group.students?.length || 0})</h3>
            
            {group.students && group.students.length > 0 ? (
              <div className="students-list">
                {group.students.map(student => (
                  <div key={student.id} className="student-item">
                    <span>{student.fio}</span>
                    <span> {student.id}</span>
                    {student.phone && (
                      <span className="phone">📱 {student.phone}</span>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="no-students">В группе нет студентов</p>
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
};

// Функция форматирования расписания
const formatSchedule = (schedule) => {
  if (!schedule || Object.keys(schedule).length === 0) return '';
  
  const dayNames = {
    'monday': 'Пн',
    'tuesday': 'Вт',
    'wednesday': 'Ср',
    'thursday': 'Чт',
    'friday': 'Пт',
    'saturday': 'Сб',
    'sunday': 'Вс'
  };
  
  const scheduleItems = [];
  for (const [day, time] of Object.entries(schedule)) {
    if (time && time.trim()) {
      scheduleItems.push(`${dayNames[day] || day}: ${time}`);
    }
  }
  
  return scheduleItems.join(', ');
};

export default GroupModal;