import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import './RegistrationsView.css';

const RegistrationsView = ({ showNotification }) => {
  const [registrations, setRegistrations] = useState([]);
  const [allDates, setAllDates] = useState([]); // Список всех доступных дат
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedSchool, setSelectedSchool] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  // Загружаем все записи один раз при монтировании для списка дат
  useEffect(() => {
    loadAllRegistrationsForDates();
  }, []);

  // Загружаем записи при изменении даты или школы
  useEffect(() => {
    loadRegistrations();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDate, selectedSchool]);

  const loadAllRegistrationsForDates = async () => {
    try {
      const response = await api.get('/exam-registrations/');
      const allRegs = response.data || [];
      // Извлекаем уникальные даты
      const dates = [...new Set(
        allRegs
          .map(reg => {
            if (!reg.exam_date) return '';
            return typeof reg.exam_date === 'string' 
              ? reg.exam_date.split('T')[0] 
              : reg.exam_date;
          })
          .filter(date => date)
      )].sort();
      setAllDates(dates);
    } catch (err) {
      console.error('Ошибка загрузки дат:', err);
      // Не показываем ошибку пользователю, так как это только для списка дат
    }
  };

  const loadRegistrations = async () => {
    setIsLoading(true);
    try {
      const params = {};
      if (selectedDate) {
        params.date = selectedDate;
      }
      if (selectedSchool) {
        params.school = selectedSchool;
      }
      const response = await api.get('/exam-registrations/', { params });
      console.log('Загружены записи:', response.data); // Для отладки
      const data = Array.isArray(response.data) ? response.data : [];
      setRegistrations(data);
      if (data.length === 0 && !selectedDate && !selectedSchool) {
        console.log('Нет записей на экзамен');
      }
    } catch (err) {
      console.error('Ошибка загрузки записей:', err); // Для отладки
      console.error('Детали ошибки:', err.response?.data); // Для отладки
      const errorMessage = err.response?.data?.detail || err.message || 'Неизвестная ошибка';
      showNotification('Ошибка загрузки записей: ' + errorMessage, 'error');
      setRegistrations([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDateChange = (e) => {
    setSelectedDate(e.target.value);
  };

  const handleSchoolChange = (e) => {
    setSelectedSchool(e.target.value);
  };

  const clearFilter = () => {
    setSelectedDate('');
    setSelectedSchool('');
    // loadRegistrations вызовется автоматически через useEffect
  };

  const handleCheckboxChange = async (registrationId, field, value) => {
    try {
      await api.put(`/exam-registrations/${registrationId}`, {
        [field]: value
      });
      // Обновляем локальное состояние
      setRegistrations(prevRegs =>
        prevRegs.map(reg =>
          reg.id === registrationId ? { ...reg, [field]: value } : reg
        )
      );
      showNotification('Статус обновлен', 'success');
    } catch (err) {
      console.error('Ошибка обновления статуса:', err);
      showNotification('Ошибка обновления статуса', 'error');
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    try {
      // Если дата уже в формате YYYY-MM-DD, форматируем напрямую
      if (typeof dateStr === 'string' && /^\d{4}-\d{2}-\d{2}/.test(dateStr)) {
        const [year, month, day] = dateStr.split('T')[0].split('-');
        return `${day}.${month}.${year}`;
      }
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) return dateStr;
      return date.toLocaleDateString('ru-RU', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      });
    } catch {
      return dateStr;
    }
  };

  const formatDateTime = (dateTimeStr) => {
    if (!dateTimeStr) return '';
    try {
      const date = new Date(dateTimeStr);
      return date.toLocaleString('ru-RU', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return dateTimeStr;
    }
  };

  // Используем список всех доступных дат
  const availableDates = allDates;

  if (isLoading) {
    return (
      <div className="registrations-container">
        <div className="loading">Загрузка записей...</div>
      </div>
    );
  }

  return (
    <div className="registrations-container">
      <div className="section-header">
        <h2>Записи на экзамен через телеграм бот</h2>
      </div>

      <div className="registrations-filters">
        <div className="filter-group">
          <label htmlFor="date-filter">Фильтр по дню:</label>
          <select
            id="date-filter"
            value={selectedDate}
            onChange={handleDateChange}
            className="date-select"
          >
            <option value="">Все дни</option>
            {availableDates.map(date => (
              <option key={date} value={date}>
                {formatDate(date)}
              </option>
            ))}
          </select>
        </div>
        <div className="filter-group">
          <label htmlFor="school-filter">Фильтр по школе:</label>
          <select
            id="school-filter"
            value={selectedSchool}
            onChange={handleSchoolChange}
            className="date-select"
          >
            <option value="">Все школы</option>
            <option value="Лермонтова">Лермонтова</option>
            <option value="Байкальская">Байкальская</option>
          </select>
        </div>
        {(selectedDate || selectedSchool) && (
          <button onClick={clearFilter} className="btn-clear-filter">
            Сбросить фильтры
          </button>
        )}
        <div className="registrations-count">
          Всего записей: {registrations.length}
        </div>
      </div>

      {registrations.length === 0 ? (
        <div className="no-registrations">
          {selectedDate || selectedSchool ? (
            <p>Нет записей по выбранным фильтрам</p>
          ) : (
            <p>Нет записей на экзамен</p>
          )}
        </div>
      ) : (
        <div className="registrations-table-container">
          <table className="registrations-table">
            <thead>
              <tr>
                <th>ФИО студента</th>
                <th>Класс</th>
                <th>Предмет</th>
                <th>Дата экзамена</th>
                <th>Время</th>
                <th>Школа</th>
                <th>Подтверждено</th>
                <th>Пришел на экзамен</th>
                <th>Сдал работу</th>
              </tr>
            </thead>
            <tbody>
              {registrations.map(reg => (
                <tr key={reg.id}>
                  <td>{reg.student_fio || 'Неизвестно'}</td>
                  <td>{reg.student_class || '-'}</td>
                  <td>{reg.subject}</td>
                  <td>{formatDate(reg.exam_date)}</td>
                  <td>{reg.exam_time}</td>
                  <td>{reg.school || '-'}</td>
                  <td>
                    {reg.confirmed ? (
                      <span className="confirmed-badge">✓ Да</span>
                    ) : (
                      <span className="not-confirmed-badge">Нет</span>
                    )}
                  </td>
                  <td>
                    <label className="checkbox-container">
                      <input
                        type="checkbox"
                        checked={reg.attended || false}
                        onChange={(e) => handleCheckboxChange(reg.id, 'attended', e.target.checked)}
                      />
                      <span className="checkmark"></span>
                    </label>
                  </td>
                  <td>
                    <label className="checkbox-container">
                      <input
                        type="checkbox"
                        checked={reg.submitted_work || false}
                        onChange={(e) => handleCheckboxChange(reg.id, 'submitted_work', e.target.checked)}
                      />
                      <span className="checkmark"></span>
                    </label>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default RegistrationsView;

