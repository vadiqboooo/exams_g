import React, { useState, useEffect } from 'react';
import Modal from '../common/Modal';

const GroupForm = ({ group = null, students = [], onClose, showNotification }) => {
  const [formData, setFormData] = useState({
    name: group?.name || '',
    teacher: group?.teacher || '',
    school: group?.school || '',
    subject: group?.subject || '',
    exam_type: group?.exam_type || '',
    student_ids: group?.students?.map(s => s.id) || [],
    schedule: group?.schedule || {
      monday: '',
      tuesday: '',
      wednesday: '',
      thursday: '',
      friday: '',
      saturday: '',
      sunday: ''
    }
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.name.trim() || !formData.teacher.trim()) {
      showNotification('Заполните обязательные поля', 'error');
      return;
    }

    setLoading(true);
    try {
      // Здесь будет вызов API для создания/обновления группы
      showNotification(
        group ? 'Группа обновлена' : 'Группа создана', 
        'success'
      );
      onClose();
    } catch (err) {
      showNotification('Ошибка сохранения', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleStudentToggle = (studentId) => {
    setFormData(prev => ({
      ...prev,
      student_ids: prev.student_ids.includes(studentId)
        ? prev.student_ids.filter(id => id !== studentId)
        : [...prev.student_ids, studentId]
    }));
  };

  const handleScheduleChange = (day, value) => {
    setFormData(prev => ({
      ...prev,
      schedule: {
        ...prev.schedule,
        [day]: value
      }
    }));
  };

  const daysOfWeek = [
    { id: 'monday', label: 'Понедельник' },
    { id: 'tuesday', label: 'Вторник' },
    { id: 'wednesday', label: 'Среда' },
    { id: 'thursday', label: 'Четверг' },
    { id: 'friday', label: 'Пятница' },
    { id: 'saturday', label: 'Суббота' },
    { id: 'sunday', label: 'Воскресенье' }
  ];

  return (
    <Modal onClose={onClose} size="lg">
      <form onSubmit={handleSubmit} className="group-form">
        <h2>{group ? 'Редактировать группу' : 'Создать группу'}</h2>

        <div className="form-row">
          <div className="form-group">
            <label>Название группы *</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Например: 11А класс, Группа 1"
              required
            />
          </div>

          <div className="form-group">
            <label>Преподаватель *</label>
            <input
              type="text"
              value={formData.teacher}
              onChange={(e) => setFormData({ ...formData, teacher: e.target.value })}
              placeholder="ФИО преподавателя"
              required
            />
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label>Школа</label>
            <input
              type="text"
              value={formData.school}
              onChange={(e) => setFormData({ ...formData, school: e.target.value })}
              placeholder="Название школы"
            />
          </div>

          <div className="form-group">
            <label>Предмет</label>
            <select
              value={formData.subject}
              onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
            >
              <option value="">Выберите предмет</option>
              <option value="rus">Русский язык</option>
              <option value="math_profile">Математика (профиль)</option>
              <option value="math_base">Математика (база)</option>
              <option value="phys">Физика</option>
              <option value="infa">Информатика</option>
              <option value="bio">Биология</option>
              <option value="hist">История</option>
              <option value="soc">Обществознание</option>
              <option value="eng">Английский язык</option>
            </select>
          </div>

          <div className="form-group">
            <label>Тип экзамена</label>
            <select
              value={formData.exam_type}
              onChange={(e) => setFormData({ ...formData, exam_type: e.target.value })}
            >
              <option value="">Выберите тип</option>
              <option value="ege">ЕГЭ</option>
              <option value="oge">ОГЭ</option>
              <option value="vpr">ВПР</option>
              <option value="test">Контрольная</option>
              <option value="other">Другое</option>
            </select>
          </div>
        </div>

        <div className="form-section">
          <h3>Расписание занятий</h3>
          <div className="schedule-grid">
            {daysOfWeek.map(day => (
              <div key={day.id} className="schedule-item">
                <label>{day.label}</label>
                <input
                  type="text"
                  value={formData.schedule[day.id]}
                  onChange={(e) => handleScheduleChange(day.id, e.target.value)}
                  placeholder="18:00-19:30"
                />
              </div>
            ))}
          </div>
        </div>

        <div className="form-section">
          <h3>Студенты в группе</h3>
          <div className="students-selection">
            {students.length === 0 ? (
              <p className="no-students">Нет доступных студентов</p>
            ) : (
              <div className="students-checkbox-list">
                {students.map(student => (
                  <label key={student.id} className="student-checkbox">
                    <input
                      type="checkbox"
                      checked={formData.student_ids.includes(student.id)}
                      onChange={() => handleStudentToggle(student.id)}
                    />
                    <span>{student.fio} {student.phone && `(${student.phone})`}</span>
                  </label>
                ))}
              </div>
            )}
            <div className="selected-count">
              Выбрано: {formData.student_ids.length} студентов
            </div>
          </div>
        </div>

        <div className="form-actions">
          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? 'Сохранение...' : group ? 'Обновить' : 'Создать'}
          </button>
          <button type="button" onClick={onClose} className="btn btn-secondary">
            Отмена
          </button>
        </div>
      </form>
    </Modal>
  );
};

export default GroupForm;