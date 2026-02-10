import { useState } from 'react';

const ATTENDANCE_STATUSES = [
  { value: 'present', label: 'Присутствовал', color: '#22c55e' },
  { value: 'trial', label: 'Пробный урок', color: '#3b82f6' },
  { value: 'trial_absent', label: 'Не пришел на пробный', color: '#ef4444' },
  { value: 'excused', label: 'Уважительная причина', color: '#f59e0b' },
  { value: 'absent', label: 'Неуважительная причина', color: '#dc2626' }
];

const StudentAttendanceRow = ({
  student,
  attendance,
  onChange,
  disabled = false
}) => {
  const [focusedComment, setFocusedComment] = useState(false);

  const handleChange = (field, value) => {
    if (disabled) return;
    onChange(student.id, {
      ...attendance,
      [field]: value
    });
  };

  const currentStatus = ATTENDANCE_STATUSES.find(
    s => s.value === (attendance.attendance_status || 'present')
  );

  return (
    <tr className="table-body-row">
      <td className="table-body-cell">{student.fio}</td>

      <td className="table-body-cell">
        <div className="status-select-wrapper">
          <div
            className="status-indicator"
            style={{ backgroundColor: currentStatus?.color || '#22c55e' }}
          ></div>
          <select
            value={attendance.attendance_status || 'present'}
            onChange={(e) => handleChange('attendance_status', e.target.value)}
            disabled={disabled}
            className="status-select-input"
          >
            {ATTENDANCE_STATUSES.map(status => (
              <option key={status.value} value={status.value}>
                {status.label}
              </option>
            ))}
          </select>
        </div>
      </td>

      <td className="table-body-cell">
        <input
          type="text"
          value={attendance.grade_value || ''}
          onChange={(e) => handleChange('grade_value', e.target.value ? parseInt(e.target.value) : null)}
          placeholder="1-5"
          disabled={disabled}
          className="grade-input-field"
        />
      </td>

      <td className="table-body-cell">
        <input
          type="text"
          value={attendance.homework_grade_value || ''}
          onChange={(e) => handleChange('homework_grade_value', e.target.value ? parseInt(e.target.value) : null)}
          placeholder="1-5"
          disabled={disabled}
          className="grade-input-field"
        />
      </td>

      <td className="table-body-cell">
        <textarea
          value={attendance.comment || ''}
          onChange={(e) => handleChange('comment', e.target.value)}
          placeholder="Комментарий..."
          rows={focusedComment ? 4 : 1}
          onFocus={() => setFocusedComment(true)}
          onBlur={() => setFocusedComment(false)}
          disabled={disabled}
          className="comment-textarea-field"
        />
      </td>
    </tr>
  );
};

export default StudentAttendanceRow;
