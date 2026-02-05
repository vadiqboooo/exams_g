import React, { useState, useEffect } from 'react';
import api from '../../services/api';

const TeacherForm = ({ teacher, onClose, onSuccess, showNotification, teachers = [] }) => {
  const [formData, setFormData] = useState({
    username: '',
    password: '',
    teacher_name: '',
    role: 'teacher',
    school: ''
  });
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (teacher) {
      setFormData({
        username: teacher.username || '',
        password: '', // Пароль не заполняем при редактировании
        teacher_name: teacher.teacher_name || '',
        role: teacher.role || 'teacher',
        school: teacher.school || ''
      });
    }
  }, [teacher]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    
    // Если изменяется username, проверяем уникальность в реальном времени
    if (name === 'username' && value.trim()) {
      const usernameLower = value.trim().toLowerCase();
      const existingTeacher = teachers.find(t => 
        t.username.toLowerCase() === usernameLower && 
        (!teacher || t.id !== teacher.id)
      );
      
      if (existingTeacher) {
        setErrors(prev => ({
          ...prev,
          username: 'Учитель с таким именем пользователя уже существует'
        }));
      } else {
        // Очищаем ошибку, если имя уникально
        setErrors(prev => ({
          ...prev,
          username: ''
        }));
      }
    } else {
      // Очищаем ошибку для других полей
      if (errors[name]) {
        setErrors(prev => ({
          ...prev,
          [name]: ''
        }));
      }
    }
  };

  const validate = () => {
    const newErrors = {};

    if (!formData.username.trim()) {
      newErrors.username = 'Имя пользователя обязательно';
    } else {
      // Проверяем, не существует ли уже учитель с таким именем пользователя
      const usernameLower = formData.username.trim().toLowerCase();
      const existingTeacher = teachers.find(t => 
        t.username.toLowerCase() === usernameLower && 
        (!teacher || t.id !== teacher.id) // При редактировании исключаем текущего учителя
      );
      
      if (existingTeacher) {
        newErrors.username = 'Учитель с таким именем пользователя уже существует';
      }
    }

    if (!teacher && !formData.password) {
      newErrors.password = 'Пароль обязателен';
    }

    if (formData.password && formData.password.length < 6) {
      newErrors.password = 'Пароль должен быть не менее 6 символов';
    }

    if (!formData.teacher_name.trim()) {
      newErrors.teacher_name = 'Имя учителя обязательно';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validate()) {
      return;
    }

    setIsLoading(true);
    try {
      if (teacher) {
        // Обновление существующего учителя
        const updateData = {
          username: formData.username,
          teacher_name: formData.teacher_name,
          school: formData.role === 'school_admin' ? formData.school : null
        };

        // Добавляем пароль только если он указан
        if (formData.password) {
          updateData.password = formData.password;
        }

        await api.put(`/teachers/${teacher.id}`, updateData);
        showNotification(`${formData.role === 'school_admin' ? 'Администратор' : 'Учитель'} успешно обновлен`, 'success');
      } else {
        // Создание нового учителя или school_admin
        await api.post('/teachers/', {
          username: formData.username,
          password: formData.password,
          teacher_name: formData.teacher_name,
          role: formData.role,
          school: formData.role === 'school_admin' ? formData.school : null
        });
        showNotification(`${formData.role === 'school_admin' ? 'Администратор' : 'Учитель'} успешно создан`, 'success');
      }
      onSuccess();
    } catch (err) {
      console.error('Ошибка сохранения учителя:', err);
      const errorMessage = err.response?.data?.detail || err.message || 'Неизвестная ошибка';
      showNotification('Ошибка сохранения учителя: ' + errorMessage, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="teacher-form">
      <h3>{teacher ? 'Редактировать сотрудника' : 'Добавить сотрудника'}</h3>
      
      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label htmlFor="username">
            Имя пользователя <span className="required">*</span>
          </label>
          <input
            type="text"
            id="username"
            name="username"
            value={formData.username}
            onChange={handleChange}
            className={errors.username ? 'error' : ''}
            disabled={isLoading}
          />
          {errors.username && <span className="error-message">{errors.username}</span>}
        </div>

        <div className="form-group">
          <label htmlFor="password">
            Пароль {!teacher && <span className="required">*</span>}
            {teacher && <span className="hint">(оставьте пустым, чтобы не менять)</span>}
          </label>
          <input
            type="password"
            id="password"
            name="password"
            value={formData.password}
            onChange={handleChange}
            className={errors.password ? 'error' : ''}
            disabled={isLoading}
            placeholder={teacher ? 'Оставьте пустым, чтобы не менять' : ''}
          />
          {errors.password && <span className="error-message">{errors.password}</span>}
        </div>

        <div className="form-group">
          <label htmlFor="teacher_name">
            Имя сотрудника <span className="required">*</span>
          </label>
          <input
            type="text"
            id="teacher_name"
            name="teacher_name"
            value={formData.teacher_name}
            onChange={handleChange}
            className={errors.teacher_name ? 'error' : ''}
            disabled={isLoading}
          />
          {errors.teacher_name && <span className="error-message">{errors.teacher_name}</span>}
        </div>

        <div className="form-group">
          <label htmlFor="role">
            Роль <span className="required">*</span>
          </label>
          <select
            id="role"
            name="role"
            value={formData.role}
            onChange={handleChange}
            disabled={isLoading || teacher}
          >
            <option value="teacher">Учитель</option>
            <option value="school_admin">Администратор школы</option>
            <option value="owner">Владелец</option>
          </select>
        </div>

        {formData.role === 'school_admin' && (
          <div className="form-group">
            <label htmlFor="school">
              Школа <span className="required">*</span>
            </label>
            <select
              id="school"
              name="school"
              value={formData.school}
              onChange={handleChange}
              disabled={isLoading}
              required
            >
              <option value="">Выберите школу</option>
              <option value="Байкальская">Байкальская</option>
              <option value="Лермонтова">Лермонтова</option>
            </select>
          </div>
        )}

        <div className="form-actions">
          <button type="button" onClick={onClose} className="btn-secondary" disabled={isLoading}>
            Отмена
          </button>
          <button type="submit" className="btn-primary" disabled={isLoading}>
            {isLoading ? 'Сохранение...' : (teacher ? 'Сохранить' : 'Создать')}
          </button>
        </div>
      </form>
    </div>
  );
};

export default TeacherForm;

