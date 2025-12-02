import React, { useState } from 'react';
import { useStudents } from '../../hooks/useStudents';

const StudentForm = ({ student = null, onClose, showNotification }) => {
  const { createStudent, updateStudent } = useStudents();
  const [formData, setFormData] = useState({
    fio: student?.fio || '',
    phone: student?.phone || ''
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.fio.trim()) {
      showNotification('Введите ФИО студента', 'error');
      return;
    }

    setLoading(true);
    try {
      if (student) {
        await updateStudent(student.id, formData);
        showNotification('Студент обновлён', 'success');
      } else {
        await createStudent(formData);
        showNotification('Студент добавлен', 'success');
      }
      onClose();
    } catch (err) {
      showNotification(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="student-form">
      <div className="form-group">
        <label>ФИО *</label>
        <input
          type="text"
          value={formData.fio}
          onChange={(e) => setFormData({ ...formData, fio: e.target.value })}
          placeholder="Иванов Иван Иванович"
          required
        />
      </div>
      
      <div className="form-group">
        <label>Телефон (необязательно)</label>
        <input
          type="text"
          value={formData.phone}
          onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
          placeholder="+7 (999) 123-45-67"
        />
      </div>

      <div className="form-actions">
        <button type="submit" className="btn btn-primary" disabled={loading}>
          {loading ? 'Сохранение...' : student ? 'Обновить' : 'Добавить'}
        </button>
        <button type="button" onClick={onClose} className="btn btn-secondary">
          Отмена
        </button>
      </div>
    </form>
  );
};

export default StudentForm;