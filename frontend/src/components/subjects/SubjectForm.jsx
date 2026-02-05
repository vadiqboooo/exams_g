import React, { useState, useEffect } from 'react';
import { useApi } from '../../hooks/useApi';
import './SubjectForm.css';

const SubjectForm = ({ subject, onClose, onSuccess }) => {
  const { makeRequest, loading } = useApi();
  const isEdit = !!subject;

  const [formData, setFormData] = useState({
    code: '',
    name: '',
    exam_type: 'ЕГЭ',
    tasks_count: 0,
    max_per_task: [],
    primary_to_secondary_scale: [],
    grade_scale: [],  // Для ОГЭ
    special_config: null,
    topics: [],
    is_active: true
  });

  const [tasks, setTasks] = useState([]);  // [{label: "1", maxScore: 1}, ...]
  const [scaleInput, setScaleInput] = useState('');
  const [errors, setErrors] = useState({});

  // Состояния для таблицы перевода баллов ЕГЭ
  const [showScaleEditor, setShowScaleEditor] = useState(false);
  const [scaleMarkers, setScaleMarkers] = useState([]);  // [{id, primaryScore, label, type, color}]
  const [newMarker, setNewMarker] = useState({ primaryScore: '', label: '', type: 'custom' });

  // Состояния для тем
  const [showTopicsEditor, setShowTopicsEditor] = useState(false);
  const [expandedTasks, setExpandedTasks] = useState(new Set());  // Набор индексов развернутых заданий
  const [newTopicByTask, setNewTopicByTask] = useState({});  // {taskIndex: "название темы"}

  const [hoverCard, setHoverCard] = useState({ visible: false, type: null, index: null, labelValue: '', scoreValue: '', position: {} });

  useEffect(() => {
    if (subject) {
      setFormData({
        code: subject.code || '',
        name: subject.name || '',
        exam_type: subject.exam_type || 'ЕГЭ',
        tasks_count: subject.tasks_count || 0,
        max_per_task: subject.max_per_task || [],
        primary_to_secondary_scale: subject.primary_to_secondary_scale || [],
        grade_scale: subject.grade_scale || [],
        special_config: subject.special_config || null,
        topics: subject.topics || [],
        is_active: subject.is_active !== undefined ? subject.is_active : true
      });

      // Преобразуем max_per_task в tasks для редактирования
      const maxPerTask = subject.max_per_task || [];
      setTasks(maxPerTask.map((score, index) => ({
        label: String(index + 1),
        maxScore: score
      })));

      setScaleInput((subject.primary_to_secondary_scale || []).join(', '));
    }
  }, [subject]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;

    // Если меняется тип экзамена, очищаем соответствующие таблицы перевода
    if (name === 'exam_type') {
      if (value === 'ОГЭ') {
        // Переключаемся на ОГЭ: очищаем таблицу тестовых баллов ЕГЭ
        setFormData(prev => ({
          ...prev,
          exam_type: value,
          primary_to_secondary_scale: []
        }));
        setScaleInput('');
      } else if (value === 'ЕГЭ') {
        // Переключаемся на ЕГЭ: очищаем таблицу оценок ОГЭ
        setFormData(prev => ({
          ...prev,
          exam_type: value,
          grade_scale: []
        }));
      }
    } else {
      setFormData(prev => ({
        ...prev,
        [name]: type === 'checkbox' ? checked : value
      }));
    }
  };

  const handleTaskLabelChange = (index, newLabel) => {
    const newTasks = [...tasks];
    newTasks[index].label = newLabel;
    setTasks(newTasks);
  };

  const handleTaskScoreChange = (index, newScore) => {
    const score = parseInt(newScore) || 1;
    const newTasks = [...tasks];
    newTasks[index].maxScore = score;
    setTasks(newTasks);
  };

  const showHoverCard = (e, type, index) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setHoverCard({
      visible: true,
      type,
      index,
      labelValue: tasks[index].label,
      scoreValue: String(tasks[index].maxScore),
      position: {
        top: rect.bottom + window.scrollY + 8,
        left: rect.left + window.scrollX,
      }
    });
  };

  const hideHoverCard = () => {
    setHoverCard({ visible: false, type: null, index: null, labelValue: '', scoreValue: '', position: {} });
  };

  // Закрытие hover card при клике вне её
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (hoverCard.visible && !e.target.closest('.hover-card') && !e.target.closest('.score-item')) {
        hideHoverCard();
      }
    };

    if (hoverCard.visible) {
      document.addEventListener('click', handleClickOutside);
    }

    return () => {
      document.removeEventListener('click', handleClickOutside);
    };
  }, [hoverCard.visible]);

  const handleHoverCardLabelChange = (e) => {
    setHoverCard(prev => ({ ...prev, labelValue: e.target.value }));
  };

  const handleHoverCardScoreChange = (e) => {
    setHoverCard(prev => ({ ...prev, scoreValue: e.target.value }));
  };

  const saveHoverCardValue = () => {
    handleTaskLabelChange(hoverCard.index, hoverCard.labelValue);
    handleTaskScoreChange(hoverCard.index, hoverCard.scoreValue);
    hideHoverCard();
  };

  const handleAddTask = () => {
    setTasks([...tasks, { label: String(tasks.length + 1), maxScore: 1 }]);
  };

  const handleRemoveTask = (index) => {
    setTasks(tasks.filter((_, i) => i !== index));
  };

  // Вычисляем максимальный первичный балл
  const getTotalPrimaryScore = () => {
    return tasks.reduce((sum, task) => sum + task.maxScore, 0);
  };

  const handleScaleInputChange = (e) => {
    const input = e.target.value;
    setScaleInput(input);

    if (!input.trim()) {
      setFormData(prev => ({ ...prev, primary_to_secondary_scale: [] }));
      return;
    }

    // Парсим таблицу перевода баллов
    const values = input.split(',').map(v => {
      const num = parseInt(v.trim());
      return isNaN(num) ? 0 : num;
    });

    setFormData(prev => ({
      ...prev,
      primary_to_secondary_scale: values
    }));
  };

  // Функции для работы с метками на шкале баллов
  const handleAddMarker = () => {
    const score = parseInt(newMarker.primaryScore);
    const maxScore = getTotalPrimaryScore();

    if (isNaN(score) || score < 0 || score > maxScore) {
      alert(`Первичный балл должен быть от 0 до ${maxScore}`);
      return;
    }

    // Проверяем, что таблица перевода заполнена
    if (!formData.primary_to_secondary_scale || formData.primary_to_secondary_scale.length === 0) {
      alert('Сначала заполните таблицу перевода баллов');
      return;
    }

    // Проверяем, что для этого первичного балла есть тестовый балл
    if (score >= formData.primary_to_secondary_scale.length) {
      alert(`Для первичного балла ${score} нет тестового балла в таблице перевода`);
      return;
    }

    if (!newMarker.label.trim()) {
      alert('Введите название метки');
      return;
    }

    const markerColors = {
      passing: '#ef4444',    // красный
      average: '#f59e0b',    // оранжевый
      part1: '#3b82f6',      // синий
      custom: '#8b5cf6'      // фиолетовый
    };

    const secondaryScore = formData.primary_to_secondary_scale[score];

    const marker = {
      id: Date.now(),
      primaryScore: score,
      secondaryScore: secondaryScore,
      label: newMarker.label,
      type: newMarker.type,
      color: markerColors[newMarker.type] || markerColors.custom
    };

    setScaleMarkers(prev => [...prev, marker].sort((a, b) => a.secondaryScore - b.secondaryScore));
    setNewMarker({ primaryScore: '', label: '', type: 'custom' });
  };

  const handleRemoveMarker = (id) => {
    setScaleMarkers(prev => prev.filter(m => m.id !== id));
  };

  const getMarkerTypeName = (type) => {
    const types = {
      passing: 'Проходной балл',
      average: 'Средний балл',
      part1: 'Балл за 1 часть',
      custom: 'Кастомная метка'
    };
    return types[type] || types.custom;
  };

  // Функции для работы с темами
  const toggleTaskExpanded = (taskIndex) => {
    setExpandedTasks(prev => {
      const newSet = new Set(prev);
      if (newSet.has(taskIndex)) {
        newSet.delete(taskIndex);
      } else {
        newSet.add(taskIndex);
      }
      return newSet;
    });
  };

  const handleAddTopicToTask = (taskIndex) => {
    const topicText = newTopicByTask[taskIndex]?.trim();
    if (!topicText) return;

    const taskNumber = taskIndex + 1;  // Номер задания (индекс + 1)

    setFormData(prev => ({
      ...prev,
      topics: [...prev.topics, { task_number: taskNumber, topic: topicText }]
    }));

    // Очищаем поле ввода для этого задания
    setNewTopicByTask(prev => ({ ...prev, [taskIndex]: '' }));
  };

  const handleRemoveTopicFromTask = (topicIndex) => {
    setFormData(prev => ({
      ...prev,
      topics: prev.topics.filter((_, i) => i !== topicIndex)
    }));
  };

  const getTopicsForTask = (taskNumber) => {
    return formData.topics
      .map((topic, index) => ({ ...topic, originalIndex: index }))
      .filter(topic => topic.task_number === taskNumber);
  };

  // Функции для работы с таблицей оценок ОГЭ
  const handleGradeScaleChange = (gradeIndex, field, value) => {
    setFormData(prev => {
      const newGradeScale = [...prev.grade_scale];
      newGradeScale[gradeIndex] = {
        ...newGradeScale[gradeIndex],
        [field]: parseInt(value) || 0
      };
      return {
        ...prev,
        grade_scale: newGradeScale
      };
    });
  };

  const handleAddGrade = () => {
    const lastGrade = formData.grade_scale.length > 0
      ? formData.grade_scale[formData.grade_scale.length - 1]
      : null;

    const newGrade = {
      grade: lastGrade ? lastGrade.grade + 1 : 2,
      min: lastGrade ? lastGrade.max + 1 : 0,
      max: lastGrade ? lastGrade.max + 5 : 10
    };

    setFormData(prev => ({
      ...prev,
      grade_scale: [...prev.grade_scale, newGrade]
    }));
  };

  const handleRemoveGrade = (index) => {
    setFormData(prev => ({
      ...prev,
      grade_scale: prev.grade_scale.filter((_, i) => i !== index)
    }));
  };

  const handleInitializeDefaultGradeScale = () => {
    const maxScore = getTotalPrimaryScore();
    const defaultScale = [
      { grade: 2, min: 0, max: Math.floor(maxScore * 0.3) },
      { grade: 3, min: Math.floor(maxScore * 0.3) + 1, max: Math.floor(maxScore * 0.5) },
      { grade: 4, min: Math.floor(maxScore * 0.5) + 1, max: Math.floor(maxScore * 0.7) },
      { grade: 5, min: Math.floor(maxScore * 0.7) + 1, max: maxScore }
    ];
    setFormData(prev => ({
      ...prev,
      grade_scale: defaultScale
    }));
  };

  const validate = () => {
    const newErrors = {};

    if (!formData.code.trim()) {
      newErrors.code = 'Укажите код предмета';
    }

    if (!formData.name.trim()) {
      newErrors.name = 'Укажите название предмета';
    }

    if (tasks.length === 0) {
      newErrors.tasks = 'Добавьте хотя бы одно задание';
    }

    // Проверяем, что все метки заданий заполнены
    const emptyLabels = tasks.some(task => !task.label.trim());
    if (emptyLabels) {
      newErrors.tasks = 'Все задания должны иметь номер/название';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validate()) return;

    try {
      const payload = {
        ...formData,
        // Преобразуем tasks в max_per_task для бэкенда
        tasks_count: tasks.length,
        max_per_task: tasks.map(task => task.maxScore),
        // Для ЕГЭ: таблица тестовых баллов, grade_scale = null
        // Для ОГЭ: таблица оценок, primary_to_secondary_scale = null
        primary_to_secondary_scale: formData.exam_type === 'ЕГЭ'
          ? (formData.primary_to_secondary_scale.length > 0 ? formData.primary_to_secondary_scale : null)
          : null,
        grade_scale: formData.exam_type === 'ОГЭ'
          ? (formData.grade_scale.length > 0 ? formData.grade_scale : null)
          : null
      };

      if (isEdit) {
        await makeRequest('PUT', `/subjects/${subject.id}`, payload);
      } else {
        await makeRequest('POST', '/subjects/', payload);
      }

      onSuccess();
    } catch (err) {
      console.error('Ошибка сохранения предмета:', err);
      alert('Ошибка сохранения: ' + (err.response?.data?.detail || err.message));
    }
  };

  return (
    <div className="subject-form-container">
      <div className="subject-form">
        <form onSubmit={handleSubmit}>
          <div className="form-columns">
            {/* Левая колонка - Базовая информация */}
            <div className="form-column-left">
              <div className="form-section">
                <div className="tasks-title-row">
                  <h3>Основная информация</h3>
                </div>

            <div className="form-row">
              <div className="form-group form-group-code">
                <label htmlFor="code">
                  Код предмета <span className="required">*</span>
                </label>
                <input
                  type="text"
                  id="code"
                  name="code"
                  value={formData.code}
                  onChange={handleChange}
                  placeholder="rus, math_profile, infa_9"
                  disabled={isEdit}
                  className={errors.code ? 'error' : ''}
                />
                {errors.code && <span className="error-text">{errors.code}</span>}
              </div>

              <div className="form-group form-group-toggle">
                <label className="toggle-label-text">
                  Статус
                </label>
                <div className="toggle-wrapper">
                  <label className="toggle-switch">
                    <input
                      type="checkbox"
                      id="is_active"
                      name="is_active"
                      checked={formData.is_active}
                      onChange={handleChange}
                    />
                    <span className="toggle-slider"></span>
                  </label>
                  <span className={`toggle-status-text ${formData.is_active ? 'active' : 'inactive'}`}>
                    {formData.is_active ? 'Активен' : 'Неактивен'}
                  </span>
                </div>
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="name">
                Название <span className="required">*</span>
              </label>
              <input
                type="text"
                id="name"
                name="name"
                value={formData.name}
                onChange={handleChange}
                placeholder="Русский язык"
                className={errors.name ? 'error' : ''}
              />
              {errors.name && <span className="error-text">{errors.name}</span>}
            </div>

            <div className="form-group">
              <label htmlFor="exam_type">
                Тип экзамена <span className="required">*</span>
              </label>
              <select
                id="exam_type"
                name="exam_type"
                value={formData.exam_type}
                onChange={handleChange}
              >
                <option value="ЕГЭ">ЕГЭ</option>
                <option value="ОГЭ">ОГЭ</option>
              </select>
              <small className="help-text">
                {formData.exam_type === 'ЕГЭ'
                  ? '💡 Для ЕГЭ требуется таблица перевода первичных баллов в тестовые (100-балльная шкала)'
                  : '💡 Для ОГЭ используется только первичный балл, таблица перевода не требуется'
                }
              </small>
            </div>
              </div>
            </div>

            {/* Правая колонка - Конфигурация заданий */}
            <div className="form-column-right">
              <div className="form-section">
                <div className="tasks-header">
                  <div className="tasks-title-row">
                    <div className="tasks-count-section">
                      <h3>Задания</h3>
                      <div className="tasks-count-controls">
                        <button
                          type="button"
                          onClick={() => {
                            if (tasks.length > 0) {
                              handleRemoveTask(tasks.length - 1);
                            }
                          }}
                          className="btn-task-control"
                          disabled={tasks.length === 0}
                        >
                          −
                        </button>
                        <span className="tasks-count-number">{tasks.length}</span>
                        <button
                          type="button"
                          onClick={handleAddTask}
                          className="btn-task-control"
                        >
                          +
                        </button>
                      </div>
                    </div>
                    <div className="max-primary-score">
                      <label>Первичный балл:</label>
                      <strong>{getTotalPrimaryScore()}</strong>
                    </div>
                  </div>
                </div>

                {errors.tasks && <span className="error-text">{errors.tasks}</span>}

                <div className="max-scores-preview">
                  {tasks.length > 0 ? (
                    <div className="scores-grid">
                      {tasks.map((task, index) => (
                        <div
                          key={index}
                          className="score-item"
                          onClick={(e) => showHoverCard(e, 'both', index)}
                        >
                          <span className="task-num">{task.label}</span>
                          <span className="task-score">{task.maxScore}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="no-tasks">
                      <p>Нет заданий. Добавьте задания для настройки предмета.</p>
                    </div>
                  )}
                </div>

                {/* Hover Card для редактирования */}
                {hoverCard.visible && (
                  <div
                    className="hover-card"
                    style={{
                      position: 'absolute',
                      top: `${hoverCard.position.top}px`,
                      left: `${hoverCard.position.left}px`,
                      zIndex: 1000
                    }}
                  >
                    <div className="hover-card-content">
                      <div className="hover-card-field">
                        <label className="hover-card-label">Номер/Название</label>
                        <input
                          type="text"
                          value={hoverCard.labelValue}
                          onChange={handleHoverCardLabelChange}
                          className="hover-card-input"
                          placeholder="1, 13.1, ГК1..."
                          autoFocus
                        />
                      </div>
                      <div className="hover-card-field">
                        <label className="hover-card-label">Макс. балл</label>
                        <input
                          type="number"
                          value={hoverCard.scoreValue}
                          onChange={handleHoverCardScoreChange}
                          className="hover-card-input"
                          min="1"
                        />
                      </div>
                      <div className="hover-card-actions">
                        <button
                          type="button"
                          onClick={saveHoverCardValue}
                          className="btn-save-hover"
                        >
                          Сохранить
                        </button>
                        <button
                          type="button"
                          onClick={hideHoverCard}
                          className="btn-cancel-hover"
                        >
                          Отмена
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Таблица перевода баллов - ТОЛЬКО ДЛЯ ЕГЭ */}
          {formData.exam_type === 'ЕГЭ' && (
            <div className="form-section">
              <div className="scale-section-header">
                <h3>Таблица перевода первичных баллов в тестовые (100-балльная шкала)</h3>
                <button
                  type="button"
                  onClick={() => setShowScaleEditor(!showScaleEditor)}
                  className="btn-toggle-scale"
                >
                  {showScaleEditor ? '▼ Скрыть' : '▶ Настроить'}
                </button>
              </div>

              {showScaleEditor && (
                <div className="scale-editor">
                  {/* Timeline визуализация */}
                  <div className="scale-timeline-section">
                    <h4>Визуализация тестовых баллов (0-100) и метки</h4>

                    {formData.primary_to_secondary_scale && formData.primary_to_secondary_scale.length > 0 ? (
                      <div className="timeline-container">
                        <div className="timeline-track">
                          <div className="timeline-line"></div>

                          {/* Метки на шкале */}
                          {scaleMarkers.map(marker => {
                            // Позиция рассчитывается по тестовому баллу (0-100)
                            const position = marker.secondaryScore;

                            return (
                              <div
                                key={marker.id}
                                className="timeline-marker"
                                style={{ left: `${position}%` }}
                              >
                                <div
                                  className="marker-dot"
                                  style={{ backgroundColor: marker.color }}
                                ></div>
                                <div className="marker-label" style={{ borderColor: marker.color }}>
                                  <div className="marker-label-text">{marker.label}</div>
                                  <div className="marker-score">
                                    {marker.primaryScore} перв. → {marker.secondaryScore} тест.
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveMarker(marker.id)}
                                    className="btn-remove-marker"
                                  >
                                    ×
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>

                        {/* Шкала баллов - тестовые от 0 до 100 */}
                        <div className="timeline-scale">
                          <span>0</span>
                          <span>25</span>
                          <span>50</span>
                          <span>75</span>
                          <span>100</span>
                        </div>
                      </div>
                    ) : (
                      <div className="timeline-empty">
                        <p>Сначала заполните таблицу перевода баллов ниже, чтобы добавлять метки на timeline.</p>
                      </div>
                    )}

                    {/* Форма добавления метки */}
                    <div className="marker-form">
                      <div className="marker-form-fields">
                        <div className="form-group-inline">
                          <label>Первичный балл</label>
                          <input
                            type="number"
                            value={newMarker.primaryScore}
                            onChange={(e) => setNewMarker(prev => ({ ...prev, primaryScore: e.target.value }))}
                            placeholder="0"
                            min="0"
                            max={getTotalPrimaryScore()}
                          />
                          <small className="help-text-inline">
                            {newMarker.primaryScore && formData.primary_to_secondary_scale[parseInt(newMarker.primaryScore)] !== undefined
                              ? `→ ${formData.primary_to_secondary_scale[parseInt(newMarker.primaryScore)]} тест.`
                              : ''}
                          </small>
                        </div>

                        <div className="form-group-inline">
                          <label>Название</label>
                          <input
                            type="text"
                            value={newMarker.label}
                            onChange={(e) => setNewMarker(prev => ({ ...prev, label: e.target.value }))}
                            placeholder="Название метки"
                          />
                        </div>

                        <div className="form-group-inline">
                          <label>Тип</label>
                          <select
                            value={newMarker.type}
                            onChange={(e) => setNewMarker(prev => ({ ...prev, type: e.target.value }))}
                          >
                            <option value="passing">Проходной балл</option>
                            <option value="average">Средний балл</option>
                            <option value="part1">Балл за 1 часть</option>
                            <option value="custom">Кастомная метка</option>
                          </select>
                        </div>

                        <button
                          type="button"
                          onClick={handleAddMarker}
                          className="btn-add-marker"
                        >
                          + Добавить метку
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Таблица перевода (существующее поле) */}
                  <div className="scale-data-section">
                    <h4>Таблица перевода баллов</h4>
                    <div className="form-group">
                      <label htmlFor="scale_input">
                        Таблица перевода (опционально для ЕГЭ)
                      </label>
                      <textarea
                        id="scale_input"
                        value={scaleInput}
                        onChange={handleScaleInputChange}
                        placeholder="0, 3, 5, 8, 10, 12, 14, 17, 20, 22, 24, 27, ..."
                        rows="3"
                      />
                      <small className="help-text">
                        Введите тестовые баллы (от 0 до 100) через запятую. Индекс массива = первичный балл, значение = тестовый балл.
                      </small>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Таблица перевода баллов в оценку - ТОЛЬКО ДЛЯ ОГЭ */}
          {formData.exam_type === 'ОГЭ' && (
            <div className="form-section">
              <h3>Таблица перевода первичных баллов в оценку (2-5)</h3>

              <div className="grade-scale-controls">
                <button
                  type="button"
                  onClick={handleInitializeDefaultGradeScale}
                  className="btn-initialize-scale"
                >
                  🎯 Заполнить типовыми значениями
                </button>
                <button
                  type="button"
                  onClick={handleAddGrade}
                  className="btn-add-grade"
                >
                  ➕ Добавить диапазон
                </button>
              </div>

              {formData.grade_scale.length > 0 ? (
                <div className="grade-scale-table">
                  <table>
                    <thead>
                      <tr>
                        <th>Оценка</th>
                        <th>Минимальный балл</th>
                        <th>Максимальный балл</th>
                        <th>Действия</th>
                      </tr>
                    </thead>
                    <tbody>
                      {formData.grade_scale
                        .sort((a, b) => a.grade - b.grade)
                        .map((item, index) => (
                          <tr key={index}>
                            <td>
                              <input
                                type="number"
                                min="2"
                                max="5"
                                value={item.grade}
                                onChange={(e) => handleGradeScaleChange(index, 'grade', e.target.value)}
                                className="grade-input"
                              />
                            </td>
                            <td>
                              <input
                                type="number"
                                min="0"
                                value={item.min}
                                onChange={(e) => handleGradeScaleChange(index, 'min', e.target.value)}
                                className="score-input"
                              />
                            </td>
                            <td>
                              <input
                                type="number"
                                min="0"
                                value={item.max}
                                onChange={(e) => handleGradeScaleChange(index, 'max', e.target.value)}
                                className="score-input"
                              />
                            </td>
                            <td>
                              <button
                                type="button"
                                onClick={() => handleRemoveGrade(index)}
                                className="btn-remove-grade"
                              >
                                ✕
                              </button>
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="no-grade-scale">
                  <p>Таблица оценок не настроена. Нажмите "Заполнить типовыми значениями" или добавьте диапазоны вручную.</p>
                </div>
              )}

              <small className="help-text">
                💡 Настройте диапазоны первичных баллов для каждой оценки (2-5).
                Например: оценка 3 = от 11 до 15 баллов, оценка 4 = от 16 до 20 баллов, и т.д.
              </small>
            </div>
          )}

          {/* Темы по заданиям */}
          <div className="form-section">
            <div className="topics-section-header">
              <h3>Темы по заданиям (опционально)</h3>
              <button
                type="button"
                onClick={() => setShowTopicsEditor(!showTopicsEditor)}
                className="btn-toggle-topics"
              >
                {showTopicsEditor ? '▼ Скрыть' : '▶ Настроить темы'}
              </button>
            </div>

            {showTopicsEditor && (
              <div className="topics-editor">
                {tasks.length > 0 ? (
                  <div className="tasks-topics-list">
                    {tasks.map((task, taskIndex) => {
                      const taskNumber = taskIndex + 1;
                      const taskTopics = getTopicsForTask(taskNumber);
                      const isExpanded = expandedTasks.has(taskIndex);

                      return (
                        <div key={taskIndex} className="task-topics-item">
                          <div
                            className="task-topics-header"
                            onClick={() => toggleTaskExpanded(taskIndex)}
                          >
                            <div className="task-info">
                              <span className="task-label">Задание {task.label}</span>
                              <span className="task-topics-count">
                                {taskTopics.length > 0 ? `${taskTopics.length} ${taskTopics.length === 1 ? 'тема' : taskTopics.length < 5 ? 'темы' : 'тем'}` : 'нет тем'}
                              </span>
                            </div>
                            <span className="task-expand-icon">{isExpanded ? '▼' : '▶'}</span>
                          </div>

                          {isExpanded && (
                            <div className="task-topics-content">
                              {/* Список тем для задания */}
                              {taskTopics.length > 0 && (
                                <div className="task-topics-existing">
                                  {taskTopics.map((topic) => (
                                    <div key={topic.originalIndex} className="topic-tag">
                                      <span className="topic-tag-text">{topic.topic}</span>
                                      <button
                                        type="button"
                                        onClick={() => handleRemoveTopicFromTask(topic.originalIndex)}
                                        className="btn-remove-topic-tag"
                                      >
                                        ×
                                      </button>
                                    </div>
                                  ))}
                                </div>
                              )}

                              {/* Форма добавления темы */}
                              <div className="task-topic-add-form">
                                <input
                                  type="text"
                                  value={newTopicByTask[taskIndex] || ''}
                                  onChange={(e) => setNewTopicByTask(prev => ({
                                    ...prev,
                                    [taskIndex]: e.target.value
                                  }))}
                                  placeholder="Введите название темы"
                                  className="topic-input"
                                  onKeyPress={(e) => {
                                    if (e.key === 'Enter') {
                                      e.preventDefault();
                                      handleAddTopicToTask(taskIndex);
                                    }
                                  }}
                                />
                                <button
                                  type="button"
                                  onClick={() => handleAddTopicToTask(taskIndex)}
                                  className="btn-add-topic-inline"
                                >
                                  + Добавить
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="no-tasks-for-topics">
                    <p>Сначала добавьте задания выше, чтобы настроить темы.</p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Кнопки */}
          <div className="form-actions">
            <button type="button" onClick={onClose} className="btn-cancel">
              Отмена
            </button>
            <button type="submit" className="btn-submit" disabled={loading}>
              {loading ? 'Сохранение...' : (isEdit ? 'Сохранить' : 'Создать')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default SubjectForm;
