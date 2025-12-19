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
    exam_dates_baikalskaya: [], // [{label, date, times: [], slots: {}}]
    exam_dates_lermontova: [], // [{label, date, times: [], slots: {}}]
    max_registrations: 4
  });

  // Новые даты для добавления
  const [newDateBaikalskaya, setNewDateBaikalskaya] = useState({ label: '', date: '' });
  const [newDateLermontova, setNewDateLermontova] = useState({ label: '', date: '' });
  
  // Новые времена для добавления (для каждого дня отдельно)
  const [newTimeForDate, setNewTimeForDate] = useState({ school: '', dateIndex: -1, time: '' });

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
      max_registrations: 4
    });
    setNewDateBaikalskaya({ label: '', date: '' });
    setNewDateLermontova({ label: '', date: '' });
    setNewTimeForDate({ school: '', dateIndex: -1, time: '' });
    setEditingProbnik(null);
  };

  const handleCreate = () => {
    resetForm();
    setShowForm(true);
  };

  const handleEdit = (probnik) => {
    setEditingProbnik(probnik);
    
    // Инициализируем даты с временами и слотами
    const datesBaikalskaya = (probnik.exam_dates_baikalskaya || []).map(d => ({
      label: d.label || '',
      date: d.date || '',
      times: d.times || [],
      slots: {}
    }));
    
    const datesLermontova = (probnik.exam_dates_lermontova || []).map(d => ({
      label: d.label || '',
      date: d.date || '',
      times: d.times || [],
      slots: {}
    }));
    
    // Заполняем слоты из общего объекта slots_baikalskaya/slots_lermontova
    // Для обратной совместимости: если есть старые exam_times_baikalskaya, используем их
    const oldTimesBaikalskaya = probnik.exam_times_baikalskaya || probnik.exam_times || [];
    const oldTimesLermontova = probnik.exam_times_lermontova || probnik.exam_times || [];
    
    // Если у дат нет времен, но есть старые времена, добавляем их
    datesBaikalskaya.forEach(dateItem => {
      if (!dateItem.times || dateItem.times.length === 0) {
        dateItem.times = [...oldTimesBaikalskaya];
      }
      // Заполняем слоты из slots_baikalskaya
      dateItem.times.forEach(time => {
        if (probnik.slots_baikalskaya && probnik.slots_baikalskaya[time] !== undefined) {
          dateItem.slots[time] = probnik.slots_baikalskaya[time];
        } else {
          dateItem.slots[time] = 0;
        }
      });
    });
    
    datesLermontova.forEach(dateItem => {
      if (!dateItem.times || dateItem.times.length === 0) {
        dateItem.times = [...oldTimesLermontova];
      }
      // Заполняем слоты из slots_lermontova
      dateItem.times.forEach(time => {
        if (probnik.slots_lermontova && probnik.slots_lermontova[time] !== undefined) {
          dateItem.slots[time] = probnik.slots_lermontova[time];
        } else {
          dateItem.slots[time] = 0;
        }
      });
    });
    
    // Создаем общие объекты слотов для обратной совместимости
    const slotsBaikalskaya = {};
    const slotsLermontova = {};
    
    datesBaikalskaya.forEach(dateItem => {
      dateItem.times.forEach(time => {
        if (dateItem.slots[time] !== undefined) {
          slotsBaikalskaya[time] = dateItem.slots[time];
        }
      });
    });
    
    datesLermontova.forEach(dateItem => {
      dateItem.times.forEach(time => {
        if (dateItem.slots[time] !== undefined) {
          slotsLermontova[time] = dateItem.slots[time];
        }
      });
    });
    
    setFormData({
      name: probnik.name,
      is_active: probnik.is_active,
      slots_baikalskaya: slotsBaikalskaya,
      slots_lermontova: slotsLermontova,
      exam_dates_baikalskaya: datesBaikalskaya,
      exam_dates_lermontova: datesLermontova,
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
      // Преобразуем данные: создаем общие объекты слотов из слотов каждого дня
      const slotsBaikalskaya = {};
      const slotsLermontova = {};
      
      formData.exam_dates_baikalskaya.forEach(dateItem => {
        dateItem.times.forEach(time => {
          if (dateItem.slots[time] !== undefined) {
            slotsBaikalskaya[time] = dateItem.slots[time];
          }
        });
      });
      
      formData.exam_dates_lermontova.forEach(dateItem => {
        dateItem.times.forEach(time => {
          if (dateItem.slots[time] !== undefined) {
            slotsLermontova[time] = dateItem.slots[time];
          }
        });
      });
      
      const submitData = {
        ...formData,
        slots_baikalskaya: slotsBaikalskaya,
        slots_lermontova: slotsLermontova
      };
      
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
        body: JSON.stringify(submitData)
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
      [field]: [...prev[field], { 
        label: newDate.label, 
        date: newDate.date,
        times: [],
        slots: {}
      }]
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

  const addTimeToDate = (school, dateIndex) => {
    const time = newTimeForDate.time;
    if (!time || !time.match(/^\d{1,2}:\d{2}$/)) {
      showNotification('Введите время в формате ЧЧ:ММ (например, 9:00)', 'error');
      return;
    }
    
    if (newTimeForDate.school !== school || newTimeForDate.dateIndex !== dateIndex) {
      setNewTimeForDate({ school, dateIndex, time: '' });
      return;
    }
    
    const field = school === 'baikalskaya' ? 'exam_dates_baikalskaya' : 'exam_dates_lermontova';
    
    setFormData(prev => {
      const dates = [...prev[field]];
      const dateItem = { ...dates[dateIndex] };
      
      // Проверяем, нет ли уже такого времени
      if (dateItem.times.includes(time)) {
        showNotification('Это время уже добавлено для этого дня', 'error');
        return prev;
      }
      
      dateItem.times = [...dateItem.times, time];
      dateItem.slots = { ...dateItem.slots, [time]: 0 };
      
      dates[dateIndex] = dateItem;
      
      return {
        ...prev,
        [field]: dates
      };
    });
    
    setNewTimeForDate({ school: '', dateIndex: -1, time: '' });
  };

  const removeTimeFromDate = (school, dateIndex, time) => {
    const field = school === 'baikalskaya' ? 'exam_dates_baikalskaya' : 'exam_dates_lermontova';
    
    setFormData(prev => {
      const dates = [...prev[field]];
      const dateItem = { ...dates[dateIndex] };
      
      dateItem.times = dateItem.times.filter(t => t !== time);
      const newSlots = { ...dateItem.slots };
      delete newSlots[time];
      dateItem.slots = newSlots;
      
      dates[dateIndex] = dateItem;
      
      return {
        ...prev,
        [field]: dates
      };
    });
  };

  const updateSlotsForDate = (school, dateIndex, time, value) => {
    const field = school === 'baikalskaya' ? 'exam_dates_baikalskaya' : 'exam_dates_lermontova';
    
    setFormData(prev => {
      const dates = [...prev[field]];
      const dateItem = { ...dates[dateIndex] };
      
      dateItem.slots = {
        ...dateItem.slots,
        [time]: parseInt(value) || 0
      };
      
      dates[dateIndex] = dateItem;
      
      return {
        ...prev,
        [field]: dates
      };
    });
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
                  
                  {formData.exam_dates_baikalskaya.map((dateItem, dateIndex) => (
                    <div key={dateIndex} className="date-with-times">
                      <div className="date-header">
                        <span className="date-label">{dateItem.label} ({dateItem.date})</span>
                        <button type="button" onClick={() => removeDate('baikalskaya', dateIndex)} className="btn-remove">×</button>
                      </div>
                      
                      <div className="date-times-section">
                        <h6>Время для этого дня:</h6>
                        <div className="times-list">
                          {dateItem.times.map(time => (
                            <div key={time} className="time-item">
                              <span>{time}</span>
                              <button type="button" onClick={() => removeTimeFromDate('baikalskaya', dateIndex, time)} className="btn-remove">×</button>
                            </div>
                          ))}
                        </div>
                        <div className="add-time-row">
                          <input
                            type="text"
                            value={newTimeForDate.school === 'baikalskaya' && newTimeForDate.dateIndex === dateIndex ? newTimeForDate.time : ''}
                            onChange={(e) => setNewTimeForDate({ school: 'baikalskaya', dateIndex, time: e.target.value })}
                            placeholder="Время (например, 9:00)"
                            pattern="\d{1,2}:\d{2}"
                          />
                          <button type="button" onClick={() => addTimeToDate('baikalskaya', dateIndex)} className="btn-add">+</button>
                        </div>
                        
                        <h6>Места для этого дня:</h6>
                        <div className="slots-row">
                          {dateItem.times.map(time => (
                            <div key={time} className="slot-input">
                              <label>{time}</label>
                              <input
                                type="number"
                                value={dateItem.slots[time] || 0}
                                onChange={(e) => updateSlotsForDate('baikalskaya', dateIndex, time, e.target.value)}
                                min="0"
                              />
                            </div>
                          ))}
                          {dateItem.times.length === 0 && (
                            <p className="no-slots-message">Добавьте время для этого дня</p>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Лермонтова */}
              <div className="form-section">
                <h4>Филиал: Лермонтова</h4>
                
                <div className="sub-section">
                  <h5>Дни проведения</h5>
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
                  
                  {formData.exam_dates_lermontova.map((dateItem, dateIndex) => (
                    <div key={dateIndex} className="date-with-times">
                      <div className="date-header">
                        <span className="date-label">{dateItem.label} ({dateItem.date})</span>
                        <button type="button" onClick={() => removeDate('lermontova', dateIndex)} className="btn-remove">×</button>
                      </div>
                      
                      <div className="date-times-section">
                        <h6>Время для этого дня:</h6>
                        <div className="times-list">
                          {dateItem.times.map(time => (
                            <div key={time} className="time-item">
                              <span>{time}</span>
                              <button type="button" onClick={() => removeTimeFromDate('lermontova', dateIndex, time)} className="btn-remove">×</button>
                            </div>
                          ))}
                        </div>
                        <div className="add-time-row">
                          <input
                            type="text"
                            value={newTimeForDate.school === 'lermontova' && newTimeForDate.dateIndex === dateIndex ? newTimeForDate.time : ''}
                            onChange={(e) => setNewTimeForDate({ school: 'lermontova', dateIndex, time: e.target.value })}
                            placeholder="Время (например, 9:00)"
                            pattern="\d{1,2}:\d{2}"
                          />
                          <button type="button" onClick={() => addTimeToDate('lermontova', dateIndex)} className="btn-add">+</button>
                        </div>
                        
                        <h6>Места для этого дня:</h6>
                        <div className="slots-row">
                          {dateItem.times.map(time => (
                            <div key={time} className="slot-input">
                              <label>{time}</label>
                              <input
                                type="number"
                                value={dateItem.slots[time] || 0}
                                onChange={(e) => updateSlotsForDate('lermontova', dateIndex, time, e.target.value)}
                                min="0"
                              />
                            </div>
                          ))}
                          {dateItem.times.length === 0 && (
                            <p className="no-slots-message">Добавьте время для этого дня</p>
                          )}
                        </div>
                      </div>
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
          probniks.map(probnik => {
            const datesBaikalskaya = probnik.exam_dates_baikalskaya || [];
            const datesLermontova = probnik.exam_dates_lermontova || [];
            
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
                          const formattedDate = parts.length === 3 ? `${parts[2]}.${parts[1]}.${parts[0]}` : d.date;
                          const timesStr = d.times && d.times.length > 0 ? ` (${d.times.join(', ')})` : '';
                          return `${d.label} ${formattedDate}${timesStr}`;
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
                          const formattedDate = parts.length === 3 ? `${parts[2]}.${parts[1]}.${parts[0]}` : d.date;
                          const timesStr = d.times && d.times.length > 0 ? ` (${d.times.join(', ')})` : '';
                          return `${d.label} ${formattedDate}${timesStr}`;
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
