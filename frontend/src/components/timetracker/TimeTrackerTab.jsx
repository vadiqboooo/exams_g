import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './TimeTrackerTab.css';

const API_BASE = import.meta.env.VITE_API_BASE_URL ||
                 (import.meta.env.DEV ? 'http://127.0.0.1:8000' : '');

export default function TimeTrackerTab({ showNotification, userRole }) {
  const [activeSession, setActiveSession] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  const token = localStorage.getItem('token');
  const isOwner = userRole === 'owner' || userRole === 'admin';

  useEffect(() => {
    fetchActiveSession();
    fetchSessions();
  }, []);

  const fetchActiveSession = async () => {
    try {
      const response = await axios.get(`${API_BASE}/work-sessions/active`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setActiveSession(response.data);
    } catch (error) {
      if (error.response?.status !== 404) {
        console.error('Ошибка загрузки активной сессии:', error);
      }
    }
  };

  const fetchSessions = async () => {
    try {
      const response = await axios.get(`${API_BASE}/work-sessions/`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setSessions(response.data);
    } catch (error) {
      console.error('Ошибка загрузки истории сессий:', error);
    }
  };

  const startSession = async () => {
    setIsLoading(true);
    try {
      await axios.post(`${API_BASE}/work-sessions/start`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      showNotification('Рабочая сессия начата', 'success');
      fetchActiveSession();
      fetchSessions();
    } catch (error) {
      showNotification(error.response?.data?.detail || 'Ошибка начала сессии', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const endSession = async () => {
    if (!activeSession) return;

    setIsLoading(true);
    try {
      await axios.post(`${API_BASE}/work-sessions/${activeSession.id}/end`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      showNotification('Рабочая сессия завершена', 'success');
      setActiveSession(null);
      fetchSessions();
    } catch (error) {
      showNotification(error.response?.data?.detail || 'Ошибка завершения сессии', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const formatDateTime = (isoString) => {
    const date = new Date(isoString);
    return date.toLocaleString('ru-RU', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatDuration = (minutes) => {
    if (!minutes) return '-';
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}ч ${mins}м`;
  };

  const getCurrentDuration = () => {
    if (!activeSession?.start_time) return '0ч 0м';
    const start = new Date(activeSession.start_time);
    const now = new Date();
    const diffMinutes = Math.floor((now - start) / 60000);
    return formatDuration(diffMinutes);
  };

  return (
    <div className="time-tracker-container">
      <h2>Рабочее время</h2>

      <div className="active-session-card">
        {activeSession ? (
          <>
            <div className="session-info">
              <div className="session-status active">Активная сессия</div>
              <p><strong>Начало:</strong> {formatDateTime(activeSession.start_time)}</p>
              <p><strong>Длительность:</strong> {getCurrentDuration()}</p>
            </div>
            <button
              onClick={endSession}
              disabled={isLoading}
              className="btn-end-session"
            >
              Закончить работу
            </button>
          </>
        ) : (
          <>
            <div className="session-info">
              <div className="session-status inactive">Нет активной сессии</div>
              <p>Начните рабочую сессию, чтобы отслеживать рабочее время</p>
            </div>
            <button
              onClick={startSession}
              disabled={isLoading}
              className="btn-start-session"
            >
              Начать работу
            </button>
          </>
        )}
      </div>

      <div className="sessions-history">
        <h3>История рабочих сессий</h3>
        {sessions.length === 0 ? (
          <p className="no-data">Нет данных</p>
        ) : (
          <table className="sessions-table">
            <thead>
              <tr>
                {isOwner && <th>Сотрудник</th>}
                <th>Начало</th>
                <th>Окончание</th>
                <th>Длительность</th>
              </tr>
            </thead>
            <tbody>
              {sessions.map(session => (
                <tr key={session.id}>
                  {isOwner && <td>{session.employee_name || '-'}</td>}
                  <td>{formatDateTime(session.start_time)}</td>
                  <td>{session.end_time ? formatDateTime(session.end_time) : 'В процессе'}</td>
                  <td>{formatDuration(session.duration_minutes)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
