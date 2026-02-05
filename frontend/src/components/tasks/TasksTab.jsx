import React, { useState, useEffect } from 'react';
import axios from 'axios';
import TaskForm from './TaskForm';
import './TasksTab.css';

const API_BASE = import.meta.env.VITE_API_BASE_URL ||
                 (import.meta.env.DEV ? 'http://127.0.0.1:8000' : '');

export default function TasksTab({ showNotification, userRole }) {
  const [tasks, setTasks] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const token = localStorage.getItem('token');
  const isOwner = userRole === 'owner' || userRole === 'admin';

  useEffect(() => {
    fetchTasks();
  }, []);

  const fetchTasks = async () => {
    setIsLoading(true);
    try {
      const response = await axios.get(`${API_BASE}/tasks/`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setTasks(response.data);
    } catch (error) {
      console.error('Ошибка загрузки задач:', error);
      showNotification('Ошибка загрузки задач', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateTask = async (taskData) => {
    try {
      await axios.post(`${API_BASE}/tasks/`, taskData, {
        headers: { Authorization: `Bearer ${token}` }
      });
      showNotification('Задача создана', 'success');
      setShowForm(false);
      fetchTasks();
    } catch (error) {
      showNotification(error.response?.data?.detail || 'Ошибка создания задачи', 'error');
    }
  };

  const handleUpdateStatus = async (taskId, newStatus) => {
    try {
      await axios.put(`${API_BASE}/tasks/${taskId}`, { status: newStatus }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      showNotification('Статус обновлен', 'success');
      fetchTasks();
    } catch (error) {
      showNotification(error.response?.data?.detail || 'Ошибка обновления статуса', 'error');
    }
  };

  const getStatusBadgeClass = (status) => {
    switch (status) {
      case 'new': return 'status-new';
      case 'in_progress': return 'status-in-progress';
      case 'completed': return 'status-completed';
      default: return '';
    }
  };

  const getStatusLabel = (status) => {
    switch (status) {
      case 'new': return 'Новая';
      case 'in_progress': return 'В работе';
      case 'completed': return 'Выполнена';
      default: return status;
    }
  };

  const formatDateTime = (isoString) => {
    if (!isoString) return '-';
    const date = new Date(isoString);
    return date.toLocaleString('ru-RU', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="tasks-container">
      <div className="tasks-header">
        <h2>Задачи</h2>
        {isOwner && (
          <button onClick={() => setShowForm(true)} className="btn-create-task">
            + Создать задачу
          </button>
        )}
      </div>

      {isLoading ? (
        <p className="loading">Загрузка...</p>
      ) : tasks.length === 0 ? (
        <p className="no-data">Нет задач</p>
      ) : (
        <div className="tasks-grid">
          {tasks.map(task => (
            <div key={task.id} className="task-card">
              <div className="task-card-header">
                <h3>{task.title}</h3>
                <span className={`status-badge ${getStatusBadgeClass(task.status)}`}>
                  {getStatusLabel(task.status)}
                </span>
              </div>

              {task.description && (
                <p className="task-description">{task.description}</p>
              )}

              <div className="task-meta">
                {task.deadline && (
                  <div className="task-meta-item">
                    <strong>Дедлайн:</strong> {formatDateTime(task.deadline)}
                  </div>
                )}
                <div className="task-meta-item">
                  <strong>Создал:</strong> {task.created_by_name || '-'}
                </div>
                <div className="task-meta-item">
                  <strong>Исполнитель:</strong> {task.assigned_to_name || '-'}
                </div>
              </div>

              {!isOwner && task.status !== 'completed' && (
                <div className="task-actions">
                  <select
                    value={task.status}
                    onChange={(e) => handleUpdateStatus(task.id, e.target.value)}
                    className="status-select"
                  >
                    <option value="new">Новая</option>
                    <option value="in_progress">В работе</option>
                    <option value="completed">Выполнена</option>
                  </select>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <TaskForm
          onSubmit={handleCreateTask}
          onClose={() => setShowForm(false)}
        />
      )}
    </div>
  );
}
