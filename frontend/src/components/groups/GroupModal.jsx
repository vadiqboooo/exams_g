import React from 'react';
import { X, User, School, BookOpen, FileText, Calendar } from 'lucide-react';
import './GroupModal.css';

const GroupModal = ({ group, onClose, showNotification }) => {
  if (!group) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="group-modal-backdrop"
        onClick={onClose}
      />

      {/* Dialog */}
      <div className="group-modal-container">
        <div className="group-modal-content">
          {/* Header */}
          <div className="group-modal-header">
            {/* Title and close button */}
            <div className="group-modal-title-row">
              <div className="group-modal-title-content">
                <h2 className="group-modal-title">{group.name}</h2>
                <div className="group-modal-meta-row">
                  <div className="group-modal-meta-item">
                    <User className="group-modal-icon" />
                    <span>{group.teacher_name || group.teacher || 'Не указан'}</span>
                  </div>
                  {group.school && (
                    <div className="group-modal-meta-item">
                      <School className="group-modal-icon" />
                      <span>{group.school}</span>
                    </div>
                  )}
                </div>
              </div>
              <button
                onClick={onClose}
                className="group-modal-close"
                aria-label="Закрыть"
              >
                <X className="group-modal-close-icon" />
              </button>
            </div>

            {/* Additional details */}
            <div className="group-modal-details">
              {group.subject && (
                <div className="group-modal-meta-item">
                  <BookOpen className="group-modal-icon" />
                  <span>{group.subject}</span>
                </div>
              )}
              {group.exam_type && (
                <div className="group-modal-meta-item">
                  <FileText className="group-modal-icon" />
                  <span>{group.exam_type}</span>
                </div>
              )}
              {group.schedule && Object.keys(group.schedule).length > 0 && (
                <div className="group-modal-meta-item">
                  <Calendar className="group-modal-icon" />
                  <span>{formatSchedule(group.schedule)}</span>
                </div>
              )}
            </div>
          </div>

          {/* Content */}
          <div className="group-modal-body">
            {/* Students Section */}
            <div className="group-modal-students">
              <h3 className="group-modal-students-title">
                Студенты группы ({group.students?.length || 0})
              </h3>
              {group.students && group.students.length > 0 ? (
                <div className="group-modal-students-list">
                  {group.students.map((student) => (
                    <div
                      key={student.id}
                      className="group-modal-student-item"
                    >
                      <span className="group-modal-student-name">
                        {student.fio}
                      </span>
                      <span className="group-modal-student-number">
                        {student.id}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="group-modal-no-students">В группе нет студентов</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
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
