import React, { useState, useEffect, useMemo } from 'react';
import { useStudents } from '../../hooks/useStudents';
import { useExams } from '../../hooks/useExams';
import { SUBJECT_TASKS, SUBJECT_OPTIONS } from '../../services/constants';
import { calculatePrimaryScore } from '../../utils/calculations';
import { validateTaskInput, formatTaskNumber } from '../../utils/helpers';
import Modal from '../common/Modal';
import TaskInput from './TaskInput';
import './ExamForm.css';

const ExamForm = ({ exam = null, onClose, showNotification }) => {
  const { students, loadStudents } = useStudents();
  const { createExam, updateExam } = useExams();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    id_student: exam?.id_student || '',
    exam_type_id: exam?.exam_type_id || '', // Добавлено
    subject: exam?.subject || '',
    customSubject: '',
    comment: exam?.comment || '',
    answers: exam?.answer ? exam.answer.split(',').map(s => s.trim()) : []
  });
  const [studentSearch, setStudentSearch] = useState('');
  const [studentDropdownOpen, setStudentDropdownOpen] = useState(false);
  const [showStudentCard, setShowStudentCard] = useState(false);

  const [examTypes, setExamTypes] = useState([]);

// 2. Загрузите их при открытии формы
  useEffect(() => {
    const fetchExamTypes = async () => {
      try {
        const response = await fetch('/exam-types/?group_id=59');
        const data = await response.json();
        setExamTypes(data);
      } catch (err) {
        console.error("Ошибка загрузки типов экзаменов", err);
      }
    };
    fetchExamTypes();
  }, []);

  // Фильтрация студентов по поисковому запросу
  const filteredStudents = useMemo(() => {
    if (!studentSearch) return students;
    const searchLower = studentSearch.toLowerCase();
    return students.filter(student => {
      const fio = (student.fio || '').toLowerCase();
      const phone = (student.phone || '').toLowerCase();
      return fio.includes(searchLower) || phone.includes(searchLower);
    });
  }, [studentSearch, students]);

  useEffect(() => {
    loadStudents();
  }, [loadStudents]);

  const subjectConfig = SUBJECT_TASKS[formData.subject];
  const tasksCount = subjectConfig?.tasks || 0;
  
  // Вычисляем максимальный балл за экзамен (сумма всех maxPerTask)
  const maxScore = useMemo(() => {
    if (!subjectConfig?.maxPerTask || subjectConfig.maxPerTask.length === 0) {
      return tasksCount; // Если нет maxPerTask, возвращаем количество заданий
    }
    
    // Для infa_9 учитываем, что из пары заданий 13.1/13.2 учитывается только один балл, задание 14 обычное
    if (formData.subject === 'infa_9') {
      let sum = 0;
      // Задания 1-12 (индексы 0-11)
      for (let i = 0; i < 12 && i < subjectConfig.maxPerTask.length; i++) {
        sum += subjectConfig.maxPerTask[i] || 0;
      }
      // Задание 13: берем максимум из 13.1 и 13.2 (индексы 12 и 13)
      if (subjectConfig.maxPerTask.length > 13) {
        sum += Math.max(subjectConfig.maxPerTask[12] || 0, subjectConfig.maxPerTask[13] || 0);
      }
      // Задание 14 обычное (индекс 14)
      if (subjectConfig.maxPerTask.length > 14) {
        sum += subjectConfig.maxPerTask[14] || 0;
      }
      // Задания 15-16 (индексы 15 и 16)
      for (let i = 15; i < subjectConfig.maxPerTask.length; i++) {
        sum += subjectConfig.maxPerTask[i] || 0;
      }
      return sum;
    }
    
    return subjectConfig.maxPerTask.reduce((sum, max) => sum + max, 0);
  }, [subjectConfig, tasksCount, formData.subject]);

  const handleSubjectChange = (value) => {
    setFormData({
      ...formData,
      subject: value,
      customSubject: value === 'custom' ? formData.customSubject : '',
      answers: []
    });
    // При выборе предмета показываем карточку студента
    if (value) {
      setShowStudentCard(true);
    } else {
      setShowStudentCard(false);
    }
  };

  const handleTaskChange = (index, value) => {
    const max = subjectConfig?.maxPerTask?.[index] || 1;
    // Используем validateTaskInput для консистентной валидации
    const clean = validateTaskInput(value, max);
    
    // Если значение пустое или равно "-", оставляем "-"
    // Также проверяем, что если введено отрицательное число, то оно не допустимо
    const finalValue = (clean === '' || clean === '-') ? '-' : clean;
    
    const newAnswers = [...formData.answers];
    // Убедимся, что массив имеет правильную длину
    while (newAnswers.length < tasksCount) newAnswers.push('-');
    newAnswers[index] = finalValue;
    setFormData({ ...formData, answers: newAnswers });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
  
    if (!formData.id_student || !formData.exam_type_id || !formData.subject) {
      showNotification('Заполните обязательные поля', 'error');
      return;
    }

    if (formData.subject === 'custom' && !formData.customSubject.trim()) {
      showNotification('Введите название предмета', 'error');
      return;
    }

    const finalSubject = formData.subject === 'custom' 
      ? formData.customSubject 
      : formData.subject;

    const examData = {
      exam_type_id: parseInt(formData.exam_type_id), // Используем ID
      id_student: parseInt(formData.id_student),
      subject: finalSubject,
      answer: formData.answers.length > 0 ? formData.answers.join(',') : null,
      comment: formData.comment || null
    };

    setLoading(true);
    try {
      if (exam) {
        await updateExam(exam.id, examData);
        showNotification('Экзамен обновлён', 'success');
      } else {
        await createExam(examData);
        showNotification('Экзамен добавлен', 'success');
      }
      onClose();
    } catch (err) {
      showNotification(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  // Закрываем выпадающий список при клике вне поля
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (!event.target.closest('.student-select-wrapper')) {
        setStudentDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Форматирование названия предмета для отображения (добавляем "(ОГЭ)" для предметов ending on "_9")
  const getSubjectDisplayName = (subject) => {
    if (!subject) return '';
    if (subject.endsWith('_9')) {
      return `${subjectConfig?.name || subject} (ОГЭ)`;
    }
    return subjectConfig?.name || subject;
  };

  return (
    <Modal onClose={onClose} size='xl'>
      <form onSubmit={handleSubmit} className="exam-form">
        <h2>{exam ? 'Редактировать экзамен' : 'Добавить экзамен'}</h2>

        <div className="form-row">
          <div className="form-group">
            <label>Студент *</label>
            <div className="student-select-wrapper">
              <input
                type="text"
                placeholder="Начните вводить имя студента..."
                value={studentSearch}
                onChange={(e) => setStudentSearch(e.target.value)}
                onFocus={() => setStudentDropdownOpen(true)}
                className="student-search-input"
                style={{
                  width: '100%',
                  padding: '10px',
                  border: '2px solid #e0e0e0',
                  borderRadius: '6px',
                  fontSize: '14px',
                  boxSizing: 'border-box'
                }}
              />
              {studentDropdownOpen && (
                <div className="student-dropdown">
                  {filteredStudents.length > 0 ? (
                    filteredStudents.map(s => (
                      <div
                        key={s.id}
                        className="student-option"
                        onClick={() => {
                          setFormData({...formData, id_student: s.id});
                          setStudentSearch(s.fio);
                          setStudentDropdownOpen(false);
                        }}
                      >
                        {s.fio} {s.phone && `(${s.phone})`}
                      </div>
                    ))
                  ) : (
                    <div className="student-option no-results">Студенты не найдены</div>
                  )}
                </div>
              )}
            </div>
            {formData.id_student && (
              <div className="selected-student-display" style={{
                padding: '10px',
                backgroundColor: '#d4edda',
                borderRadius: '6px',
                marginTop: '10px',
                border: '1px solid #c3e6cb'
              }}>
                <strong>Выбран студент:</strong> {studentSearch || formData.id_student}
              </div>
            )}
          </div>

          <div className="form-group">
            <label>Название экзамена *</label>
            <select
              value={formData.exam_type_id}
              onChange={(e) => setFormData({ ...formData, exam_type_id: e.target.value })}
              required
            >
              <option value="">Выберите тип экзамена</option>
              {examTypes.map(type => (
                <option key={type.id} value={type.id}>
                  {type.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="form-group">
          <label>Предмет *</label>
          <select
            value={formData.subject}
            onChange={(e) => handleSubjectChange(e.target.value)}
            required
          >
            <option value="">— Выберите предмет —</option>
            {SUBJECT_OPTIONS.map(option => {
              // Добавляем "(ОГЭ)" для предметов ending on "_9"
              let displayLabel = option.label;
              if (option.value.endsWith('_9')) {
                displayLabel = `${option.label} (ОГЭ)`;
              }
              return (
                <option key={option.value} value={option.value}>
                  {displayLabel}
                </option>
              );
            })}
          </select>

          {formData.subject === 'custom' && (
            <input
              type="text"
              value={formData.customSubject}
              onChange={(e) => setFormData({ ...formData, customSubject: e.target.value })}
              placeholder="Например: Литература, Геометрия 9 класс, ВПР и т.д."
              className="custom-subject-input"
              style={{ marginTop: '10px' }}
            />
          )}
        </div>

        {/* Карточка студента при выборе предмета */}
        {showStudentCard && subjectConfig && tasksCount > 0 && (
          <div className="student-exam-card" style={{
            backgroundColor: '#f8f9fa',
            padding: '20px',
            borderRadius: '8px',
            marginBottom: '20px',
            border: '1px solid #dee2e6'
          }}>
            <div className="student-exam-header">
              <div className="student-info">
                <div className="student-name">
                  <strong>{studentSearch || formData.id_student || 'Выберите студента'}</strong>
                </div>
              </div>
            </div>

            <div className="student-exam-content">
              <div className="exam-tasks-section">
                <div className="tasks-header">
                  <div className="tasks-label">Задания: {getSubjectDisplayName(formData.subject)} ({tasksCount} шт.)</div>
                </div>
                
                <div className="tasks-grid" style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(60px, 1fr))',
                  gap: '10px',
                  marginTop: '15px'
                }}>
                  {Array.from({ length: tasksCount }, (_, i) => {
                    const taskNumber = formatTaskNumber(i, formData.subject, tasksCount);
                    return (
                      <div key={i} className="task-item">
                        <div className="task-header">
                          <div className="task-number" style={{
                            fontSize: '12px',
                          
                            marginBottom: '5px',
                            textAlign: 'center'
                          }}>
                            {taskNumber}
                          </div>
                          <input
                            value={formData.answers[i] === '-' ? '' : formData.answers[i] || ''}
                            onChange={(e) => handleTaskChange(i, e.target.value)}
                            className="task-input"
                            placeholder="-"
                            style={{
                              width: '100%',
                              padding: '8px',
                              textAlign: 'center',
                              border: '1px solid #ced4da',
                              borderRadius: '4px',
                              fontSize: '14px'
                            }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="exam-comment-section" style={{ marginTop: '20px' }}>
                <div className="comment-header">
                  <div className="comment-label">
                    Комментарий:
                  </div>
                </div>
                <textarea
                  value={formData.comment}
                  onChange={(e) => setFormData({ ...formData, comment: e.target.value })}
                  className="comment-textarea"
                  rows="3"
                  placeholder="Введите комментарий..."
                  style={{
                    width: '100%',
                    padding: '10px',
                    border: '1px solid #ced4da',
                    borderRadius: '4px',
                    fontSize: '14px',
                    marginTop: '10px',
                    resize: 'vertical'
                  }}
                />
              </div>

              <div className="primary-score" style={{
                marginTop: '15px',
                padding: '12px',
                backgroundColor: '#e7f3ff',
                borderRadius: '6px',
                fontSize: '16px',
                fontWeight: 'bold',
                textAlign: 'center'
              }}>
                Первичный балл: {calculatePrimaryScore(formData.answers, formData.subject, subjectConfig?.maxPerTask)}
                {maxScore > 0 && (
                  <span className="score-max">/{maxScore}</span>
                )}
              </div>
            </div>
          </div>
        )}

        <div className="form-actions" style={{
          display: 'flex',
          gap: '10px',
          justifyContent: 'flex-end',
          marginTop: '20px'
        }}>
          <button type="button" onClick={onClose} className="btn btn-secondary">
            Отмена
          </button>
          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? 'Сохранение...' : exam ? 'Обновить' : 'Сохранить'}
          </button>
        </div>
      </form>
    </Modal>
  );
};

export default ExamForm;