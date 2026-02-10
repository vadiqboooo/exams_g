import { useState, useEffect } from 'react';

const LessonForm = ({ onSubmit, onClose, showNotification }) => {
  const [formData, setFormData] = useState({
    group_id: '',
    lesson_date: '',
    duration_minutes: 90,
    topic: '',
    homework: '',
    grading_mode: 'numeric',
    total_tasks: 10,
    homework_total_tasks: 10
  });

  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchGroups();
  }, []);

  const fetchGroups = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('http://127.0.0.1:8000/groups/', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error('Ошибка загрузки групп');
      }

      const data = await response.json();
      setGroups(data);
    } catch (error) {
      console.error('Error fetching groups:', error);
      showNotification('Ошибка загрузки групп', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    if (!formData.group_id || !formData.lesson_date) {
      showNotification('Заполните все обязательные поля', 'error');
      return;
    }

    // Преобразуем дату в ISO формат
    const lessonDate = new Date(formData.lesson_date).toISOString();

    onSubmit({
      ...formData,
      group_id: parseInt(formData.group_id),
      lesson_date: lessonDate,
      duration_minutes: parseInt(formData.duration_minutes),
      total_tasks: formData.grading_mode === 'tasks' ? parseInt(formData.total_tasks) : null,
      homework_total_tasks: formData.grading_mode === 'tasks' ? parseInt(formData.homework_total_tasks) : null
    });
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content lesson-form-modal" onClick={(e) => e.stopPropagation()}>
        <h2>Создать урок</h2>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Группа *</label>
            <select
              value={formData.group_id}
              onChange={(e) => setFormData({ ...formData, group_id: e.target.value })}
              required
            >
              <option value="">Выберите группу</option>
              {groups.map(group => (
                <option key={group.id} value={group.id}>
                  {group.name} - {group.subject || 'Предмет не указан'}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label>Дата и время *</label>
            <input
              type="datetime-local"
              value={formData.lesson_date}
              onChange={(e) => setFormData({ ...formData, lesson_date: e.target.value })}
              required
            />
          </div>

          <div className="form-group">
            <label>Длительность (минуты)</label>
            <input
              type="number"
              value={formData.duration_minutes}
              onChange={(e) => setFormData({ ...formData, duration_minutes: e.target.value })}
              min="30"
              max="300"
            />
          </div>

          <div className="form-group">
            <label>Тема урока</label>
            <input
              type="text"
              value={formData.topic}
              onChange={(e) => setFormData({ ...formData, topic: e.target.value })}
              placeholder="Например: Квадратные уравнения"
            />
          </div>

          <div className="form-group">
            <label>Домашнее задание</label>
            <textarea
              value={formData.homework}
              onChange={(e) => setFormData({ ...formData, homework: e.target.value })}
              placeholder="Например: Решить задачи №5-10 из учебника"
              rows={3}
              className="form-input"
            />
          </div>

          <div className="form-group">
            <label>Режим оценивания</label>
            <select
              value={formData.grading_mode}
              onChange={(e) => setFormData({ ...formData, grading_mode: e.target.value })}
            >
              <option value="numeric">Числовая оценка</option>
              <option value="tasks">Количество задач</option>
            </select>
          </div>

          {formData.grading_mode === 'tasks' && (
            <>
              <div className="form-group">
                <label>Всего задач на уроке</label>
                <input
                  type="number"
                  value={formData.total_tasks}
                  onChange={(e) => setFormData({ ...formData, total_tasks: e.target.value })}
                  min="1"
                  max="100"
                />
              </div>

              <div className="form-group">
                <label>Всего задач в домашке</label>
                <input
                  type="number"
                  value={formData.homework_total_tasks}
                  onChange={(e) => setFormData({ ...formData, homework_total_tasks: e.target.value })}
                  min="1"
                  max="100"
                />
              </div>
            </>
          )}

          <div className="form-actions">
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Отмена
            </button>
            <button type="submit" className="btn btn-primary">
              Создать урок
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default LessonForm;
