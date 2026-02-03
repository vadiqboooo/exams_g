import React, { useState, useEffect } from 'react';
import { useApi } from '../../hooks/useApi';
import Modal from '../common/Modal';
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

  const [maxPerTaskInput, setMaxPerTaskInput] = useState('');
  const [scaleInput, setScaleInput] = useState('');
  const [currentTopic, setCurrentTopic] = useState({ task_number: 1, topic: '' });
  const [errors, setErrors] = useState({});

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

      // Заполняем поля ввода
      setMaxPerTaskInput((subject.max_per_task || []).join(', '));
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

  const handleTasksCountChange = (e) => {
    const count = parseInt(e.target.value) || 0;
    setFormData(prev => ({
      ...prev,
      tasks_count: count,
      // Автоматически подгоняем массив баллов под количество заданий
      max_per_task: prev.max_per_task.length > count
        ? prev.max_per_task.slice(0, count)
        : [...prev.max_per_task, ...Array(count - prev.max_per_task.length).fill(1)]
    }));
  };

  const handleMaxPerTaskInputChange = (e) => {
    const input = e.target.value;
    setMaxPerTaskInput(input);

    // Парсим массив баллов
    const values = input.split(',').map(v => {
      const num = parseInt(v.trim());
      return isNaN(num) ? 1 : num;
    });

    setFormData(prev => ({
      ...prev,
      max_per_task: values,
      tasks_count: values.length
    }));
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

  const handleAddTopic = () => {
    if (!currentTopic.topic.trim()) return;

    setFormData(prev => ({
      ...prev,
      topics: [...prev.topics, { ...currentTopic }]
    }));

    setCurrentTopic({ task_number: currentTopic.task_number + 1, topic: '' });
  };

  const handleRemoveTopic = (index) => {
    setFormData(prev => ({
      ...prev,
      topics: prev.topics.filter((_, i) => i !== index)
    }));
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
    const maxScore = formData.max_per_task.reduce((a, b) => a + b, 0);
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

    if (formData.tasks_count <= 0) {
      newErrors.tasks_count = 'Количество заданий должно быть больше 0';
    }

    if (formData.max_per_task.length !== formData.tasks_count) {
      newErrors.max_per_task = 'Количество баллов должно совпадать с количеством заданий';
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
    <Modal onClose={onClose} className="subject-form-modal">
      <div className="subject-form">
        <h2>{isEdit ? 'Редактировать предмет' : 'Добавить предмет'}</h2>

        <form onSubmit={handleSubmit}>
          {/* Базовая информация */}
          <div className="form-section">
            <h3>Основная информация</h3>

            <div className="form-group">
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

            <div className="form-group">
              <label>
                <input
                  type="checkbox"
                  name="is_active"
                  checked={formData.is_active}
                  onChange={handleChange}
                />
                Активен
              </label>
            </div>
          </div>

          {/* Конфигурация заданий */}
          <div className="form-section">
            <h3>Задания и баллы</h3>

            <div className="form-group">
              <label htmlFor="max_per_task_input">
                Максимальные баллы за задания <span className="required">*</span>
              </label>
              <input
                type="text"
                id="max_per_task_input"
                value={maxPerTaskInput}
                onChange={handleMaxPerTaskInputChange}
                placeholder="1,1,2,3,1,1,..."
                className={errors.max_per_task ? 'error' : ''}
              />
              <small className="help-text">
                Введите баллы через запятую. Количество заданий: {formData.tasks_count}
              </small>
              {errors.max_per_task && <span className="error-text">{errors.max_per_task}</span>}
            </div>

            <div className="max-scores-preview">
              {formData.max_per_task.length > 0 && (
                <div className="scores-grid">
                  {formData.max_per_task.map((score, index) => (
                    <div key={index} className="score-item">
                      <span className="task-num">№{index + 1}</span>
                      <span className="task-score">{score}б</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="form-group">
              <label>
                Максимальный первичный балл: <strong>{formData.max_per_task.reduce((a, b) => a + b, 0)}</strong>
              </label>
            </div>
          </div>

          {/* Таблица перевода баллов - ТОЛЬКО ДЛЯ ЕГЭ */}
          {formData.exam_type === 'ЕГЭ' && (
            <div className="form-section">
              <h3>Таблица перевода первичных баллов в тестовые (100-балльная шкала)</h3>

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
                  Например: первичный балл 0 → тестовый балл 0, первичный балл 1 → тестовый балл 3, и т.д.
                </small>
              </div>
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

          {/* Темы */}
          <div className="form-section">
            <h3>Темы по заданиям (опционально)</h3>

            <div className="topics-add">
              <input
                type="number"
                min="1"
                max={formData.tasks_count}
                value={currentTopic.task_number}
                onChange={(e) => setCurrentTopic(prev => ({
                  ...prev,
                  task_number: parseInt(e.target.value) || 1
                }))}
                placeholder="№ задания"
                className="topic-number-input"
              />
              <input
                type="text"
                value={currentTopic.topic}
                onChange={(e) => setCurrentTopic(prev => ({
                  ...prev,
                  topic: e.target.value
                }))}
                placeholder="Название темы"
                className="topic-name-input"
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddTopic();
                  }
                }}
              />
              <button
                type="button"
                onClick={handleAddTopic}
                className="btn-add-topic"
              >
                ➕ Добавить
              </button>
            </div>

            {formData.topics.length > 0 && (
              <div className="topics-list">
                {formData.topics
                  .sort((a, b) => a.task_number - b.task_number)
                  .map((topic, index) => (
                    <div key={index} className="topic-item">
                      <span className="topic-number">Задание {topic.task_number}:</span>
                      <span className="topic-name">{topic.topic}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveTopic(index)}
                        className="btn-remove-topic"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
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
    </Modal>
  );
};

export default SubjectForm;
