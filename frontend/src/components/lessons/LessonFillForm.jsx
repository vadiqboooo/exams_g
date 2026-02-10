import { useState, useEffect } from 'react';
import { Settings, ArrowLeft } from 'lucide-react';
import StudentAttendanceRow from './StudentAttendanceRow';
import './LessonFillForm.css';

const LessonFillForm = ({ lesson, onBack, showNotification }) => {
  const [lessonData, setLessonData] = useState(null);
  const [topic, setTopic] = useState('');
  const [homework, setHomework] = useState('');
  const [attendances, setAttendances] = useState({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [gradingMode, setGradingMode] = useState('numeric');

  useEffect(() => {
    fetchLessonDetails();
  }, [lesson.id]);

  const fetchLessonDetails = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`http://127.0.0.1:8000/lessons/${lesson.id}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error('Ошибка загрузки данных урока');
      }

      const data = await response.json();
      setLessonData(data);

      // Устанавливаем тему и домашнее задание
      setTopic(data.topic || '');
      setHomework(data.homework || '');
      setGradingMode(data.grading_mode || 'numeric');

      // Инициализируем посещаемость
      const initialAttendances = {};

      // Если есть существующая посещаемость, используем её
      if (data.attendances && data.attendances.length > 0) {
        data.attendances.forEach(att => {
          initialAttendances[att.student_id] = {
            student_id: att.student_id,
            attendance_status: att.attendance_status,
            grade_value: att.grade_value,
            homework_grade_value: att.homework_grade_value,
            comment: att.comment
          };
        });
      }

      // Для студентов без записи создаем пустую запись
      if (data.students) {
        data.students.forEach(student => {
          if (!initialAttendances[student.id]) {
            initialAttendances[student.id] = {
              student_id: student.id,
              attendance_status: 'present',
              grade_value: null,
              homework_grade_value: null,
              comment: ''
            };
          }
        });
      }

      setAttendances(initialAttendances);
    } catch (error) {
      console.error('Error fetching lesson details:', error);
      showNotification('Ошибка загрузки данных урока', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleAttendanceChange = (studentId, updatedAttendance) => {
    setAttendances(prev => ({
      ...prev,
      [studentId]: updatedAttendance
    }));
  };

  const handleSubmit = async () => {
    try {
      setSubmitting(true);
      const token = localStorage.getItem('token');

      // Сначала обновляем тему и домашнее задание, если они изменились
      if (topic !== (lessonData?.topic || '') || homework !== (lessonData?.homework || '')) {
        const updateResponse = await fetch(`http://127.0.0.1:8000/lessons/${lesson.id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            topic: topic,
            homework: homework
          })
        });

        if (!updateResponse.ok) {
          throw new Error('Ошибка сохранения темы и домашнего задания');
        }
      }

      // Затем сохраняем посещаемость
      const attendancesList = Object.values(attendances);

      const response = await fetch(`http://127.0.0.1:8000/lessons/${lesson.id}/fill`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          attendances: attendancesList
        })
      });

      if (!response.ok) {
        throw new Error('Ошибка сохранения посещаемости');
      }

      showNotification('Урок успешно заполнен', 'success');
      onBack();
    } catch (error) {
      console.error('Error submitting lesson:', error);
      showNotification('Ошибка сохранения посещаемости', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const formatDateTime = (dateStr) => {
    const date = new Date(dateStr);
    return date.toLocaleString('ru-RU', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <div className="lesson-fill-form-container">
        <div className="loading-state">
          <p>Загрузка...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="lesson-fill-form-container">
      <div className="lesson-fill-card">
        <div className="lesson-fill-content">
          {/* Header */}
          <div className="lesson-header-row">
            <div className="lesson-header-left">
              <button
                className="btn-icon"
                onClick={onBack}
                aria-label="Назад"
              >
                <ArrowLeft className="icon-size" />
              </button>
              <h1 className="lesson-title">Проведение урока</h1>
            </div>

            {/* Settings icon */}
            <div className="settings-container">
              <button
                onClick={() => setShowSettings(!showSettings)}
                className="btn-icon"
                aria-label="Настройки"
              >
                <Settings className="icon-size" />
              </button>

              {/* Settings dropdown */}
              {showSettings && (
                <>
                  <div
                    className="settings-overlay"
                    onClick={() => setShowSettings(false)}
                  ></div>

                  <div className="settings-dropdown">
                    <div className="settings-dropdown-content">
                      <h3 className="settings-dropdown-title">Настройки оценивания</h3>
                      <div>
                        <label className="field-label">Режим оценивания</label>
                        <select
                          value={gradingMode}
                          onChange={(e) => setGradingMode(e.target.value)}
                          className="form-select"
                        >
                          <option value="numeric">Числовая оценка (1-5)</option>
                          <option value="pass_fail">Зачет/Незачет</option>
                          <option value="none">Без оценки</option>
                        </select>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Compact info grid */}
          <div className="lesson-info-grid">
            <div>
              <div className="info-primary">{lessonData?.group_name}</div>
              <div className="info-secondary">{formatDateTime(lessonData?.lesson_date)}</div>
              {lessonData?.is_completed && lessonData?.completed_by_name && (
                <div className="info-completed">
                  Провел: {lessonData.completed_by_name}
                  {lessonData.completed_at && (
                    <span> • {new Date(lessonData.completed_at).toLocaleString('ru-RU', {
                      day: 'numeric',
                      month: 'short',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}</span>
                  )}
                </div>
              )}
            </div>
            <div>
              <label className="field-label">Тема урока</label>
              <input
                type="text"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="Например: Квадратные уравнения"
                disabled={lessonData?.is_completed}
                className="form-input-white"
              />
            </div>
          </div>

          {/* Homework */}
          <div className="homework-field">
            <label className="field-label">Домашнее задание</label>
            <input
              type="text"
              value={homework}
              onChange={(e) => setHomework(e.target.value)}
              placeholder="Например: Решить задачи №5-10 из учебника"
              disabled={lessonData?.is_completed}
              className="form-input-gray"
            />
          </div>

          {/* Attendance table */}
          <div className="attendance-table-section">
            <h3 className="section-title">Посещаемость и оценки</h3>
            <div className="table-wrapper">
              <table className="attendance-table">
                <thead>
                  <tr className="table-header-row">
                    <th className="table-header-cell text-left">Студент</th>
                    <th className="table-header-cell text-left status-col">Статус</th>
                    <th className="table-header-cell text-center grade-col">Оценка за урок</th>
                    <th className="table-header-cell text-center grade-col">Оценка за ДЗ</th>
                    <th className="table-header-cell text-left">Комментарий</th>
                  </tr>
                </thead>
                <tbody>
                  {lessonData?.students?.map(student => (
                    <StudentAttendanceRow
                      key={student.id}
                      student={student}
                      attendance={attendances[student.id] || {}}
                      onChange={handleAttendanceChange}
                      disabled={lessonData?.is_completed}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Actions */}
          <div className="lesson-actions">
            <button
              className="btn btn-secondary"
              onClick={onBack}
            >
              Отмена
            </button>
            {!lessonData?.is_completed && (
              <button
                className="btn btn-primary"
                onClick={handleSubmit}
                disabled={submitting}
              >
                {submitting ? 'Сохранение...' : 'Сохранить посещаемость'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default LessonFillForm;
