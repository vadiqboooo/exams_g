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
    slots_baikalskaya: {},
    slots_lermontova: {},
    exam_dates_baikalskaya: [],
    exam_dates_lermontova: [],
    exam_times_baikalskaya: [],
    exam_times_lermontova: [],
    max_registrations: 4
  });

  // Новые даты для добавления
  const [newDateBaikalskaya, setNewDateBaikalskaya] = useState({ label: '', date: '' });
  const [newDateLermontova, setNewDateLermontova] = useState({ label: '', date: '' });
  
  // Новые времена для добавления
  const [newTimeBaikalskaya, setNewTimeBaikalskaya] = useState('');
  const [newTimeLermontova, setNewTimeLermontova] = useState('');

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
      slots_baikalskaya: {},
      slots_lermontova: {},
      exam_dates_baikalskaya: [],
      exam_dates_lermontova: [],
      exam_times_baikalskaya: [],
      exam_times_lermontova: [],
      max_registrations: 4
    });
    setNewDateBaikalskaya({ label: '', date: '' });
    setNewDateLermontova({ label: '', date: '' });
    setNewTimeBaikalskaya('');
    setNewTimeLermontova('');
    setEditingProbnik(null);
  };

  const handleCreate = () => {
    resetForm();
    setShowForm(true);
  };

  const handleEdit = (probnik) => {
    setEditingProbnik(probnik);
    
    // Инициализируем времена для каждого филиала
    const timesBaikalskaya = probnik.exam_times_baikalskaya || probnik.exam_times || [];
    const timesLermontova = probnik.exam_times_lermontova || probnik.exam_times || [];
    
    // Инициализируем слоты на основе времен
    const slotsBaikalskaya = {};
    const slotsLermontova = {};
    
    if (probnik.slots_baikalskaya) {
      Object.keys(probnik.slots_baikalskaya).forEach(time => {
        slotsBaikalskaya[time] = probnik.slots_baikalskaya[time];
      });
    }
    
    if (probnik.slots_lermontova) {
      Object.keys(probnik.slots_lermontova).forEach(time => {
        slotsLermontova[time] = probnik.slots_lermontova[time];
      });
    }
    
    // Если времена заданы, но слотов нет, создаем пустые слоты
    timesBaikalskaya.forEach(time => {
      if (!slotsBaikalskaya[time]) {
        slotsBaikalskaya[time] = 0;
      }
    });
    
    timesLermontova.forEach(time => {
      if (!slotsLermontova[time]) {
        slotsLermontova[time] = 0;
      }
    });
    
    setFormData({
      name: probnik.name,
      is_active: probnik.is_active,
      slots_baikalskaya: slotsBaikalskaya,
      slots_lermontova: slotsLermontova,
      exam_dates_baikalskaya: probnik.exam_dates_baikalskaya || [],
      exam_dates_lermontova: probnik.exam_dates_lermontova || [],
      exam_times_baikalskaya: timesBaikalskaya,
      exam_times_lermontova: timesLermontova,
      max_registrations: probnik.max_registrations || 4
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

  const addDate = (school) => {
    const newDate = school === 'baikalskaya' ? newDateBaikalskaya : newDateLermontova;
    if (!newDate.label || !newDate.date) {
      showNotification('Заполните название и дату', 'error');
      return;
    }
    
    const field = school === 'baikalskaya' ? 'exam_dates_baikalskaya' : 'exam_dates_lermontova';
    setFormData(prev => ({
      ...prev,
      [field]: [...prev[field], { ...newDate }]
    }));
    
    if (school === 'baikalskaya') {
      setNewDateBaikalskaya({ label: '', date: '' });
    } else {
      setNewDateLermontova({ label: '', date: '' });
    }
  };

  const removeDate = (school, index) => {
    const field = school === 'baikalskaya' ? 'exam_dates_baikalskaya' : 'exam_dates_lermontova';
    setFormData(prev => ({
      ...prev,
      [field]: prev[field].filter((_, i) => i !== index)
    }));
  };

  const addTime = (school) => {
    const newTime = school === 'baikalskaya' ? newTimeBaikalskaya : newTimeLermontova;
    if (!newTime || !newTime.match(/^\d{1,2}:\d{2}$/)) {
      showNotification('Введите время в формате ЧЧ:ММ (например, 9:00)', 'error');
      return;
    }
    
    const field = school === 'baikalskaya' ? 'exam_times_baikalskaya' : 'exam_times_lermontova';
    const slotsField = school === 'baikalskaya' ? 'slots_baikalskaya' : 'slots_lermontova';
    
    setFormData(prev => {
      // Проверяем, нет ли уже такого времени
      if (prev[field].includes(newTime)) {
        showNotification('Это время уже добавлено', 'error');
        return prev;
      }
      
      return {
        ...prev,
        [field]: [...prev[field], newTime],
        [slotsField]: {
          ...prev[slotsField],
          [newTime]: 0
        }
      };
    });
    
    if (school === 'baikalskaya') {
      setNewTimeBaikalskaya('');
    } else {
      setNewTimeLermontova('');
    }
  };

  const removeTime = (school, time) => {
    const field = school === 'baikalskaya' ? 'exam_times_baikalskaya' : 'exam_times_lermontova';
    const slotsField = school === 'baikalskaya' ? 'slots_baikalskaya' : 'slots_lermontova';
    
    setFormData(prev => {
      const newSlots = { ...prev[slotsField] };
      delete newSlots[time];
      
      return {
        ...prev,
        [field]: prev[field].filter(t => t !== time),
        [slotsField]: newSlots
      };
    });
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

              <div className="form-group">
                <label>Максимальное количество записей на одного ученика</label>
                <input
                  type="number"
                  value={formData.max_registrations}
                  onChange={(e) => setFormData(prev => ({ ...prev, max_registrations: parseInt(e.target.value) || 4 }))}
                  min="1"
                  max="20"
                  required
                />
              </div>

              {/* Байкальская */}
              <div className="form-section">
                <h4>Филиал: Байкальская</h4>
                
                <div className="sub-section">
                  <h5>Дни проведения</h5>
                  <div className="dates-list">
                    {formData.exam_dates_baikalskaya.map((d, i) => (
                      <div key={i} className="date-item">
                        <span>{d.label} ({d.date})</span>
                        <button type="button" onClick={() => removeDate('baikalskaya', i)} className="btn-remove">×</button>
                      </div>
                    ))}
                  </div>
                  <div className="add-date-row">
                    <input
                      type="text"
                      value={newDateBaikalskaya.label}
                      onChange={(e) => setNewDateBaikalskaya(prev => ({ ...prev, label: e.target.value }))}
                      placeholder="Название (Понедельник 5.01.26)"
                    />
                    <input
                      type="date"
                      value={newDateBaikalskaya.date}
                      onChange={(e) => setNewDateBaikalskaya(prev => ({ ...prev, date: e.target.value }))}
                    />
                    <button type="button" onClick={() => addDate('baikalskaya')} className="btn-add">+</button>
                  </div>
                </div>

                <div className="sub-section">
                  <h5>Время проведения</h5>
                  <div className="times-list">
                    {formData.exam_times_baikalskaya.map(time => (
                      <div key={time} className="time-item">
                        <span>{time}</span>
                        <button type="button" onClick={() => removeTime('baikalskaya', time)} className="btn-remove">×</button>
                      </div>
                    ))}
                  </div>
                  <div className="add-time-row">
                    <input
                      type="text"
                      value={newTimeBaikalskaya}
                      onChange={(e) => setNewTimeBaikalskaya(e.target.value)}
                      placeholder="Время (например, 9:00)"
                      pattern="\d{1,2}:\d{2}"
                    />
                    <button type="button" onClick={() => addTime('baikalskaya')} className="btn-add">+</button>
                  </div>
                </div>

                <div className="sub-section">
                  <h5>Места</h5>
                  <div className="slots-row">
                    {formData.exam_times_baikalskaya.map(time => (
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
                    {formData.exam_times_baikalskaya.length === 0 && (
                      <p className="no-slots-message">Добавьте время проведения, чтобы настроить места</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Лермонтова */}
              <div className="form-section">
                <h4>Филиал: Лермонтова</h4>
                
                <div className="sub-section">
                  <h5>Дни проведения</h5>
                  <div className="dates-list">
                    {formData.exam_dates_lermontova.map((d, i) => (
                      <div key={i} className="date-item">
                        <span>{d.label} ({d.date})</span>
                        <button type="button" onClick={() => removeDate('lermontova', i)} className="btn-remove">×</button>
                      </div>
                    ))}
                  </div>
                  <div className="add-date-row">
                    <input
                      type="text"
                      value={newDateLermontova.label}
                      onChange={(e) => setNewDateLermontova(prev => ({ ...prev, label: e.target.value }))}
                      placeholder="Название (Понедельник 5.01.26)"
                    />
                    <input
                      type="date"
                      value={newDateLermontova.date}
                      onChange={(e) => setNewDateLermontova(prev => ({ ...prev, date: e.target.value }))}
                    />
                    <button type="button" onClick={() => addDate('lermontova')} className="btn-add">+</button>
                  </div>
                </div>

                <div className="sub-section">
                  <h5>Время проведения</h5>
                  <div className="times-list">
                    {formData.exam_times_lermontova.map(time => (
                      <div key={time} className="time-item">
                        <span>{time}</span>
                        <button type="button" onClick={() => removeTime('lermontova', time)} className="btn-remove">×</button>
                      </div>
                    ))}
                  </div>
                  <div className="add-time-row">
                    <input
                      type="text"
                      value={newTimeLermontova}
                      onChange={(e) => setNewTimeLermontova(e.target.value)}
                      placeholder="Время (например, 9:00)"
                      pattern="\d{1,2}:\d{2}"
                    />
                    <button type="button" onClick={() => addTime('lermontova')} className="btn-add">+</button>
                  </div>
                </div>

                <div className="sub-section">
                  <h5>Места</h5>
                  <div className="slots-row">
                    {formData.exam_times_lermontova.map(time => (
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
                    {formData.exam_times_lermontova.length === 0 && (
                      <p className="no-slots-message">Добавьте время проведения, чтобы настроить места</p>
                    )}
                  </div>
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
          probniks.map(probnik => {
            const datesBaikalskaya = probnik.exam_dates_baikalskaya || [];
            const datesLermontova = probnik.exam_dates_lermontova || [];
            const timesBaikalskaya = probnik.exam_times_baikalskaya || probnik.exam_times || [];
            const timesLermontova = probnik.exam_times_lermontova || probnik.exam_times || [];
            
            return (
              <div key={probnik.id} className={`probnik-card ${probnik.is_active ? 'active' : ''}`}>
                <div className="probnik-card-header">
                  <h3>{probnik.name}</h3>
                  <span className={`status-badge ${probnik.is_active ? 'active' : 'inactive'}`}>
                    {probnik.is_active ? '✓ Запись открыта' : 'Запись закрыта'}
                  </span>
                </div>
                
                <div className="probnik-card-body">
                  <div className="probnik-info">
                    <div className="school-info">
                      <strong>Байкальская:</strong>
                      {datesBaikalskaya.length > 0 ? (
                        <span> {datesBaikalskaya.map(d => {
                          const parts = d.date.split('-');
                          return parts.length === 3 ? `${parts[2]}.${parts[1]}.${parts[0]}` : d.date;
                        }).join(', ')}</span>
                      ) : (
                        <span> дни не указаны</span>
                      )}
                    </div>
                    <div className="school-info">
                      <strong>Лермонтова:</strong>
                      {datesLermontova.length > 0 ? (
                        <span> {datesLermontova.map(d => {
                          const parts = d.date.split('-');
                          return parts.length === 3 ? `${parts[2]}.${parts[1]}.${parts[0]}` : d.date;
                        }).join(', ')}</span>
                      ) : (
                        <span> дни не указаны</span>
                      )}
                    </div>
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
            );
          })
        )}
      </div>
    </div>
  );
};

export default ProbnikManager;
