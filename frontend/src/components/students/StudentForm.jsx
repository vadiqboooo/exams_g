import React, { useState } from 'react';
import { useStudents } from '../../hooks/useStudents';

const StudentForm = ({ student = null, onClose, showNotification }) => {
  const { createStudent, updateStudent } = useStudents();
  const userRole = localStorage.getItem("role") || "teacher";
  const isAdmin = userRole === "admin";
  
  const [formData, setFormData] = useState({
    fio: student?.fio || '',
    phone: student?.phone || '',
    admin_comment: student?.admin_comment || '',
    parent_contact_status: student?.parent_contact_status || '',
    class_num: student?.class_num || '',
    user_id: student?.user_id || ''
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
      // Подготавливаем данные для отправки
      const submitData = {
        fio: formData.fio.trim(),
        phone: formData.phone?.trim() || null
      };

      if (student) {
        // При редактировании добавляем поля администратора только если пользователь - администратор
        if (isAdmin) {
          submitData.admin_comment = formData.admin_comment?.trim() || null;
          submitData.parent_contact_status = formData.parent_contact_status?.trim() || null;
          
          // Обрабатываем class_num: пустая строка -> null, иначе число (только 9, 10, 11)
          const classNumValue = formData.class_num?.toString().trim();
          if (classNumValue) {
            const classNum = parseInt(classNumValue, 10);
            if (!isNaN(classNum) && [9, 10, 11].includes(classNum)) {
              submitData.class_num = classNum;
            } else {
              submitData.class_num = null;
            }
          } else {
            submitData.class_num = null;
          }
          
          // Обрабатываем user_id: пустая строка -> null, иначе число
          const userIdValue = formData.user_id?.toString().trim();
          submitData.user_id = userIdValue ? parseInt(userIdValue, 10) : null;
          if (isNaN(submitData.user_id)) {
            submitData.user_id = null;
          }
        }
        await updateStudent(student.id, submitData);
        showNotification('Студент обновлён', 'success');
      } else {
        // При создании нового студента не передаем поля администратора
        await createStudent(submitData);
        showNotification('Студент добавлен', 'success');
      }
      onClose();
    } catch (err) {
      // Извлекаем сообщение об ошибке из ответа сервера
      const errorMessage = err.response?.data?.detail || 
                          err.response?.data?.message || 
                          err.message || 
                          'Ошибка при сохранении студента';
      showNotification(errorMessage, 'error');
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

      {/* Поля только для администраторов и только при редактировании */}
      {isAdmin && student && (
        <>
          <div className="form-group">
            <label>Класс</label>
            <select
              value={formData.class_num || ''}
              onChange={(e) => setFormData({ ...formData, class_num: e.target.value })}
              style={{
                width: '100%',
                padding: '8px',
                fontSize: '14px',
                border: '1px solid #ddd',
                borderRadius: '4px'
              }}
            >
              <option value="">Не указан</option>
              <option value="9">9 класс</option>
              <option value="10">10 класс</option>
              <option value="11">11 класс</option>
            </select>
          </div>

          <div className="form-group">
            <label>Telegram User ID</label>
            <input
              type="number"
              value={formData.user_id || ''}
              onChange={(e) => setFormData({ ...formData, user_id: e.target.value })}
              placeholder="123456789"
              style={{
                width: '100%',
                padding: '8px',
                fontSize: '14px',
                border: '1px solid #ddd',
                borderRadius: '4px'
              }}
            />
            <small style={{ color: '#666', fontSize: '12px', display: 'block', marginTop: '4px' }}>
              ID пользователя в Telegram (число)
            </small>
          </div>

        </>
      )}

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