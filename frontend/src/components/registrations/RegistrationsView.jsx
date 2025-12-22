import React, { useState, useEffect, useMemo } from 'react';
import api from '../../services/api';
import { getSubjectDisplayName, SUBJECT_TASKS } from '../../services/constants';
import './RegistrationsView.css';

const RegistrationsView = ({ showNotification }) => {
  const [registrations, setRegistrations] = useState([]);
  const [allRegistrations, setAllRegistrations] = useState([]); // Все загруженные записи (для фильтрации)
  const [allDates, setAllDates] = useState([]); // Список всех доступных дат
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedSchool, setSelectedSchool] = useState('');
  const [selectedSubject, setSelectedSubject] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  // Загружаем все записи один раз при монтировании для списка дат
  useEffect(() => {
    loadAllRegistrationsForDates();
  }, []);

  // Загружаем записи при изменении даты или школы
  // При этом сбрасываем фильтр по предмету
  useEffect(() => {
    setSelectedSubject(''); // Сбрасываем фильтр по предмету
    loadRegistrations();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDate, selectedSchool]);

  // Фильтруем записи по предмету на клиенте
  // selectedSubject может быть строкой вида "subject:ege" или "subject:oge"
  useEffect(() => {
    if (selectedSubject) {
      const [subject, examType] = selectedSubject.split(':');
      const filtered = allRegistrations.filter(reg => {
        // Проверяем совпадение названия предмета
        if (reg.subject !== subject) return false;
        
        // Проверяем тип экзамена по классу ученика
        const studentClass = reg.student_class;
        if (examType === 'ege') {
          // Для ЕГЭ должны быть классы 10 или 11
          return studentClass === 10 || studentClass === 11;
        } else if (examType === 'oge') {
          // Для ОГЭ должен быть класс 9
          return studentClass === 9;
        }
        return false;
      });
      setRegistrations(filtered);
    } else {
      setRegistrations(allRegistrations);
    }
  }, [selectedSubject, allRegistrations]);

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
      setAllRegistrations(data);
      // Применяем фильтр по предмету, если он установлен
      if (selectedSubject) {
        const filtered = data.filter(reg => reg.subject === selectedSubject);
        setRegistrations(filtered);
      } else {
        setRegistrations(data);
      }
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
    setSelectedSubject('');
    // loadRegistrations вызовется автоматически через useEffect
  };

  const handleSubjectClick = (subject, examType) => {
    // Формируем ключ вида "subject:ege" или "subject:oge"
    const subjectKey = `${subject}:${examType}`;
    if (selectedSubject === subjectKey) {
      // Если кликнули на уже выбранный предмет, снимаем фильтр
      setSelectedSubject('');
    } else {
      setSelectedSubject(subjectKey);
    }
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

  // Подсчитываем количество уникальных учеников по каждому предмету из всех загруженных записей
  // Разделяем на ОГЭ и ЕГЭ по классу ученика
  const subjectCounts = useMemo(() => {
    const egeCounts = {};
    const ogeCounts = {};
    const studentSubjects = new Set(); // Для отслеживания уникальных комбинаций студент-предмет
    
    // Используем allRegistrations для подсчета, чтобы статистика не менялась при фильтрации
    const dataToCount = allRegistrations.length > 0 ? allRegistrations : registrations;
    
    dataToCount.forEach(reg => {
      if (reg.subject && reg.student_fio) {
        const key = `${reg.student_fio}_${reg.subject}`;
        if (!studentSubjects.has(key)) {
          studentSubjects.add(key);
          
          // Определяем, ОГЭ это или ЕГЭ по классу ученика
          // 9 класс → ОГЭ, 10-11 классы → ЕГЭ
          const studentClass = reg.student_class;
          
          if (studentClass === 9) {
            ogeCounts[reg.subject] = (ogeCounts[reg.subject] || 0) + 1;
          } else if (studentClass === 10 || studentClass === 11) {
            egeCounts[reg.subject] = (egeCounts[reg.subject] || 0) + 1;
          }
          // Если класс не указан, не учитываем в статистике
        }
      }
    });
    
    return { ege: egeCounts, oge: ogeCounts };
  }, [allRegistrations, registrations]);

  // Иконки для предметов
  const getSubjectIcon = (subject) => {
    if (!subject) return '📚';
    
    // Маппинг иконок по ключам из SUBJECT_TASKS
    const iconsByKey = {
      'rus': '📝',
      'rus_9': '📝',
      'math_profile': '🔢',
      'math_base': '🧮',
      'math_9': '🔢',
      'phys': '⚛️',
      'phys_9': '⚛️',
      'infa': '💻',
      'infa_9': '💻',
      'chem': '🧪',
      'bio': '🔬',
      'bio_9': '🔬',
      'hist': '📜',
      'hist_9': '📜',
      'soc': '👥',
      'soc_9': '👥',
      'eng': '🇬🇧',
      'eng_9': '🇬🇧',
      'geo': '🌍',
      'geo_9': '🌍'
    };
    
    // Сначала проверяем, является ли subject ключом из SUBJECT_TASKS
    if (SUBJECT_TASKS[subject] && iconsByKey[subject]) {
      return iconsByKey[subject];
    }
    
    // Если subject - это название, ищем соответствующий ключ в SUBJECT_TASKS
    for (const [key, config] of Object.entries(SUBJECT_TASKS)) {
      if (config.name === subject && iconsByKey[key]) {
        return iconsByKey[key];
      }
    }
    
    // Если не нашли, пытаемся найти по частичному совпадению названия
    const subjectLower = subject.toLowerCase();
    if (subjectLower.includes('русск')) return '📝';
    if (subjectLower.includes('математ')) return '🔢';
    if (subjectLower.includes('физик')) return '⚛️';
    if (subjectLower.includes('информатик')) return '💻';
    if (subjectLower.includes('хими')) return '🧪';
    if (subjectLower.includes('биолог')) return '🔬';
    if (subjectLower.includes('истори')) return '📜';
    if (subjectLower.includes('обществ')) return '👥';
    if (subjectLower.includes('английск')) return '🇬🇧';
    if (subjectLower.includes('географи')) return '🌍';
    
    return '📚'; // Иконка по умолчанию
  };

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
        {(selectedDate || selectedSchool || selectedSubject) && (
          <button onClick={clearFilter} className="btn-clear-filter">
            Сбросить фильтры
          </button>
        )}
        <div className="registrations-count">
          Всего записей: {registrations.length}
        </div>
      </div>

      {/* Строка с количеством учеников по предметам */}
      {registrations.length > 0 && (Object.keys(subjectCounts.ege).length > 0 || Object.keys(subjectCounts.oge).length > 0) && (
        <div className="subject-stats">
          <div className="subject-stats-scrollable">
            {/* ЕГЭ предметы */}
            {Object.keys(subjectCounts.ege).length > 0 && (
              <div className="subject-stats-section">
                <div className="subject-stats-label">ЕГЭ:</div>
                <div className="subject-stats-items">
                  {Object.entries(subjectCounts.ege)
                    .sort((a, b) => b[1] - a[1]) // Сортируем по количеству (по убыванию)
                    .map(([subject, count]) => {
                      const subjectKey = `${subject}:ege`;
                      return (
                        <div 
                          key={subject} 
                          className={`subject-stat-item ${selectedSubject === subjectKey ? 'active' : ''}`}
                          title={`${getSubjectDisplayName(subject)} - ${count} ученик${count === 1 ? '' : count < 5 ? 'а' : 'ов'}. Кликните для фильтрации`}
                          onClick={() => handleSubjectClick(subject, 'ege')}
                        >
                          <span className="subject-icon">{getSubjectIcon(subject)}</span>
                          <span className="subject-count">{count}</span>
                        </div>
                      );
                    })}
                </div>
              </div>
            )}
            
            {/* ОГЭ предметы */}
            {Object.keys(subjectCounts.oge).length > 0 && (
              <div className="subject-stats-section">
                <div className="subject-stats-label">ОГЭ:</div>
                <div className="subject-stats-items">
                  {Object.entries(subjectCounts.oge)
                    .sort((a, b) => b[1] - a[1]) // Сортируем по количеству (по убыванию)
                    .map(([subject, count]) => {
                      const subjectKey = `${subject}:oge`;
                      return (
                        <div 
                          key={subject} 
                          className={`subject-stat-item ${selectedSubject === subjectKey ? 'active' : ''}`}
                          title={`${getSubjectDisplayName(subject)} - ${count} ученик${count === 1 ? '' : count < 5 ? 'а' : 'ов'}. Кликните для фильтрации`}
                          onClick={() => handleSubjectClick(subject, 'oge')}
                        >
                          <span className="subject-icon">{getSubjectIcon(subject)}</span>
                          <span className="subject-count">{count}</span>
                        </div>
                      );
                    })}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

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

