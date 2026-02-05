import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import TeacherForm from './TeacherForm';
import Modal from '../common/Modal';

const TeacherList = ({ showNotification }) => {
  const [teachers, setTeachers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingTeacher, setEditingTeacher] = useState(null);

  useEffect(() => {
    loadTeachers();
  }, []);

  const loadTeachers = async () => {
    setIsLoading(true);
    try {
      const response = await api.get('/teachers/');
      setTeachers(response.data || []);
    } catch (err) {
      console.error('Ошибка загрузки сотрудников:', err);
      showNotification('Ошибка загрузки сотрудников', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreate = () => {
    setEditingTeacher(null);
    setShowForm(true);
  };

  const handleEdit = (teacher) => {
    setEditingTeacher(teacher);
    setShowForm(true);
  };

  const handleDelete = async (teacher) => {
    if (!window.confirm(`Вы уверены, что хотите удалить сотрудника "${teacher.teacher_name}" (${teacher.username})?`)) {
      return;
    }

    try {
      await api.delete(`/teachers/${teacher.id}`);
      showNotification('Сотрудник успешно удален', 'success');
      loadTeachers();
    } catch (err) {
      console.error('Ошибка удаления сотрудника:', err);
      const errorMessage = err.response?.data?.detail || err.message || 'Неизвестная ошибка';
      showNotification('Ошибка удаления сотрудника: ' + errorMessage, 'error');
    }
  };

  const handleFormClose = () => {
    setShowForm(false);
    setEditingTeacher(null);
  };

  const handleFormSuccess = () => {
    handleFormClose();
    loadTeachers();
  };

  if (isLoading) {
    return (
      <div className="teachers-container">
        <div className="loading">Загрузка сотрудников...</div>
      </div>
    );
  }

  return (
    <div className="teachers-container">
      <div className="section-header">
        <h2>Сотрудники</h2>
        <button onClick={handleCreate} className="btn-primary">
          + Добавить сотрудника
        </button>
      </div>

      {teachers.length === 0 ? (
        <div className="no-teachers">
          <p>Нет сотрудников. Добавьте первого сотрудника.</p>
        </div>
      ) : (
        <div className="teachers-list">
          <table className="teachers-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Имя пользователя</th>
                <th>Имя учителя</th>
                <th>Роль</th>
                <th>Школа</th>
                <th>Действия</th>
              </tr>
            </thead>
            <tbody>
              {teachers.map(teacher => (
                <tr key={teacher.id}>
                  <td>{teacher.id}</td>
                  <td>{teacher.username}</td>
                  <td>{teacher.teacher_name || '-'}</td>
                  <td>{teacher.role === 'school_admin' ? 'Админ школы' : teacher.role === 'owner' ? 'Владелец' : 'Учитель'}</td>
                  <td>{teacher.school || '-'}</td>
                  <td>
                    <div className="action-buttons">
                      <button
                        onClick={() => handleEdit(teacher)}
                        className="btn-edit"
                        title="Редактировать"
                      >
                        ✏️ Редактировать
                      </button>
                      <button
                        onClick={() => handleDelete(teacher)}
                        className="btn-delete"
                        title="Удалить"
                      >
                        🗑️ Удалить
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showForm && (
        <Modal onClose={handleFormClose}>
          <TeacherForm
            teacher={editingTeacher}
            teachers={teachers}
            onClose={handleFormClose}
            onSuccess={handleFormSuccess}
            showNotification={showNotification}
          />
        </Modal>
      )}
    </div>
  );
};

export default TeacherList;

