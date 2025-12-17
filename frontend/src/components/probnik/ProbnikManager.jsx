import React, { useState, useEffect } from 'react';
import { API_BASE } from '../../services/constants';
import './ProbnikManager.css';

const ProbnikManager = ({ showNotification }) => {
  const [probniks, setProbniks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingProbnik, setEditingProbnik] = useState(null);
  
  // Форма
  const [formData, setFormData] = useState({
    name: '',
    is_active: false,
    slots_baikalskaya: { '9:00': 45, '12:00': 45 },
    slots_lermontova: { '9:00': 45, '12:00': 45 },
    exam_dates: [],
    exam_times: ['9:00', '12:00']
  });

  // Новая дата для добавления
  const [newDate, setNewDate] = useState({ label: '', date: '' });

  const fetchProbniks = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE}/probnik/`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setProbniks(data);
      }
    } catch (error) {
      console.error('Ошибка загрузки пробников:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProbniks();
  }, []);

  const resetForm = () => {
    setFormData({
      name: '',
      is_active: false,
      slots_baikalskaya: { '9:00': 45, '12:00': 45 },
      slots_lermontova: { '9:00': 45, '12:00': 45 },
      exam_dates: [],
      exam_times: ['9:00', '12:00']
    });
    setNewDate({ label: '', date: '' });
    setEditingProbnik(null);
  };

  const handleCreate = () => {
    resetForm();
    setShowForm(true);
  };

  const handleEdit = (probnik) => {
    setEditingProbnik(probnik);
    setFormData({
      name: probnik.name,
      is_active: probnik.is_active,
      slots_baikalskaya: probnik.slots_baikalskaya || { '9:00': 45, '12:00': 45 },
      slots_lermontova: probnik.slots_lermontova || { '9:00': 45, '12:00': 45 },
      exam_dates: probnik.exam_dates || [],
      exam_times: probnik.exam_times || ['9:00', '12:00']
    });
    setShowForm(true);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Удалить этот пробник?')) return;
    
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE}/probnik/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (response.ok) {
        showNotification('Пробник удален', 'success');
        fetchProbniks();
      }
    } catch (error) {
      showNotification('Ошибка при удалении', 'error');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    try {
      const token = localStorage.getItem('token');
      const url = editingProbnik 
        ? `${API_BASE}/probnik/${editingProbnik.id}`
        : `${API_BASE}/probnik/`;
      
      const response = await fetch(url, {
        method: editingProbnik ? 'PUT' : 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(formData)
      });
      
      if (response.ok) {
        showNotification(editingProbnik ? 'Пробник обновлен' : 'Пробник создан', 'success');
        setShowForm(false);
        resetForm();
        fetchProbniks();
      } else {
        const error = await response.json();
        showNotification(error.detail || 'Ошибка', 'error');
      }
    } catch (error) {
      showNotification('Ошибка при сохранении', 'error');
    }
  };

  const addDate = () => {
    if (!newDate.label || !newDate.date) {
      showNotification('Заполните название и дату', 'error');
      return;
    }
    setFormData(prev => ({
      ...prev,
      exam_dates: [...prev.exam_dates, { ...newDate }]
    }));
    setNewDate({ label: '', date: '' });
  };

  const removeDate = (index) => {
    setFormData(prev => ({
      ...prev,
      exam_dates: prev.exam_dates.filter((_, i) => i !== index)
    }));
  };

  const updateSlots = (school, time, value) => {
    const field = school === 'baikalskaya' ? 'slots_baikalskaya' : 'slots_lermontova';
    setFormData(prev => ({
      ...prev,
      [field]: {
        ...prev[field],
        [time]: parseInt(value) || 0
      }
    }));
  };

  if (loading) {
    return <div className="probnik-loading">Загрузка...</div>;
  }

  return (
    <div className="probnik-manager">
      <div className="probnik-header">
        <h2>Управление пробниками</h2>
        <button className="btn-create" onClick={handleCreate}>
          + Создать пробник
        </button>
      </div>

      {showForm && (
        <div className="probnik-form-overlay">
          <div className="probnik-form">
            <h3>{editingProbnik ? 'Редактирование пробника' : 'Новый пробник'}</h3>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label>Название пробника</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Например: Зимний пробник 2026"
                  required
                />
              </div>

              <div className="form-group checkbox-group">
                <label>
                  <input
                    type="checkbox"
                    checked={formData.is_active}
                    onChange={(e) => setFormData(prev => ({ ...prev, is_active: e.target.checked }))}
                  />
                  Запись открыта
                </label>
              </div>

              <div className="form-section">
                <h4>Даты проведения</h4>
                <div className="dates-list">
                  {formData.exam_dates.map((d, i) => (
                    <div key={i} className="date-item">
                      <span>{d.label} ({d.date})</span>
                      <button type="button" onClick={() => removeDate(i)} className="btn-remove">×</button>
                    </div>
                  ))}
                </div>
                <div className="add-date-row">
                  <input
                    type="text"
                    value={newDate.label}
                    onChange={(e) => setNewDate(prev => ({ ...prev, label: e.target.value }))}
                    placeholder="Название (Понедельник 5.01.26)"
                  />
                  <input
                    type="date"
                    value={newDate.date}
                    onChange={(e) => setNewDate(prev => ({ ...prev, date: e.target.value }))}
                  />
                  <button type="button" onClick={addDate} className="btn-add">+</button>
                </div>
              </div>

              <div className="form-section">
                <h4>Места на Байкальской</h4>
                <div className="slots-row">
                  {formData.exam_times.map(time => (
                    <div key={time} className="slot-input">
                      <label>{time}</label>
                      <input
                        type="number"
                        value={formData.slots_baikalskaya[time] || 0}
                        onChange={(e) => updateSlots('baikalskaya', time, e.target.value)}
                        min="0"
                      />
                    </div>
                  ))}
                </div>
              </div>

              <div className="form-section">
                <h4>Места на Лермонтова</h4>
                <div className="slots-row">
                  {formData.exam_times.map(time => (
                    <div key={time} className="slot-input">
                      <label>{time}</label>
                      <input
                        type="number"
                        value={formData.slots_lermontova[time] || 0}
                        onChange={(e) => updateSlots('lermontova', time, e.target.value)}
                        min="0"
                      />
                    </div>
                  ))}
                </div>
              </div>

              <div className="form-actions">
                <button type="button" onClick={() => { setShowForm(false); resetForm(); }} className="btn-cancel">
                  Отмена
                </button>
                <button type="submit" className="btn-save">
                  {editingProbnik ? 'Сохранить' : 'Создать'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="probniks-list">
        {probniks.length === 0 ? (
          <div className="no-probniks">
            <p>Пробники не созданы</p>
            <p>Создайте первый пробник, чтобы открыть запись в телеграм-боте</p>
          </div>
        ) : (
          probniks.map(probnik => (
            <div key={probnik.id} className={`probnik-card ${probnik.is_active ? 'active' : ''}`}>
              <div className="probnik-card-header">
                <h3>{probnik.name}</h3>
                <span className={`status-badge ${probnik.is_active ? 'active' : 'inactive'}`}>
                  {probnik.is_active ? '✓ Запись открыта' : 'Запись закрыта'}
                </span>
              </div>
              
              <div className="probnik-card-body">
                <div className="probnik-info">
                  <strong>Даты:</strong>
                  {probnik.exam_dates && probnik.exam_dates.length > 0 ? (
                    <span> {probnik.exam_dates.map(d => {
                      // Форматируем дату из 2026-01-05 в 05.01.2026
                      const parts = d.date.split('-');
                      return parts.length === 3 ? `${parts[2]}.${parts[1]}.${parts[0]}` : d.date;
                    }).join(', ')}</span>
                  ) : (
                    <span> не указаны</span>
                  )}
                </div>
                
                <div className="probnik-slots">
                  <div className="school-slots">
                    <strong>Байкальская:</strong>
                    {probnik.slots_baikalskaya && Object.entries(probnik.slots_baikalskaya).map(([time, slots]) => (
                      <span key={time}> {time}: {slots} мест</span>
                    ))}
                  </div>
                  <div className="school-slots">
                    <strong>Лермонтова:</strong>
                    {probnik.slots_lermontova && Object.entries(probnik.slots_lermontova).map(([time, slots]) => (
                      <span key={time}> {time}: {slots} мест</span>
                    ))}
                  </div>
                </div>
              </div>
              
              <div className="probnik-card-actions">
                <button onClick={() => handleEdit(probnik)} className="btn-edit">
                  ✏️ Редактировать
                </button>
                <button onClick={() => handleDelete(probnik.id)} className="btn-delete">
                  🗑️ Удалить
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default ProbnikManager;

