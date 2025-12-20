import React, { useState, useEffect, useMemo } from 'react';
import { useStudents } from '../../hooks/useStudents';
import { useExams } from '../../hooks/useExams';
import { SUBJECT_TASKS, SUBJECT_OPTIONS } from '../../services/constants';
import { calculatePrimaryScore } from '../../utils/calculations';
import Modal from '../common/Modal';
import TaskInput from './TaskInput';

const ExamForm = ({ exam = null, onClose, showNotification }) => {
  const { students, loadStudents } = useStudents();
  const { createExam, updateExam } = useExams();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    id_student: exam?.id_student || '',
    name: exam?.name || '',
    subject: exam?.subject || '',
    customSubject: '',
    comment: exam?.comment || '',
    answers: exam?.answer ? exam.answer.split(',') : []
  });

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
  };

  const handleTaskChange = (index, value) => {
    const newAnswers = [...formData.answers];
    newAnswers[index] = value;
    setFormData({ ...formData, answers: newAnswers });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.id_student || !formData.name || !formData.subject) {
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
      name: formData.name,
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

  return (
    <Modal onClose={onClose} size="lg">
      <form onSubmit={handleSubmit} className="exam-form">
        <h2>{exam ? 'Редактировать экзамен' : 'Добавить экзамен'}</h2>

        <div className="form-row">
          <div className="form-group">
            <label>Студент *</label>
            <select
              value={formData.id_student}
              onChange={(e) => setFormData({ ...formData, id_student: e.target.value })}
              required
            >
              <option value="">— Выберите студента —</option>
              {students.map(s => (
                <option key={s.id} value={s.id}>
                  {s.fio} (ID: {s.id})
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label>Название экзамена *</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="ЕГЭ 2025"
              required
            />
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
            {SUBJECT_OPTIONS.map(option => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>

          {formData.subject === 'custom' && (
            <input
              type="text"
              value={formData.customSubject}
              onChange={(e) => setFormData({ ...formData, customSubject: e.target.value })}
              placeholder="Например: Литература, Геометрия 9 класс, ВПР и т.д."
              className="custom-subject-input"
            />
          )}
        </div>

        {subjectConfig && tasksCount > 0 && (
          <div className="tasks-section">
            <label>Задания: {subjectConfig.name} ({tasksCount} шт.)</label>
            <div className="tasks-grid">
              {Array.from({ length: tasksCount }, (_, i) => (
                <TaskInput
                  key={i}
                  index={i}
                  maxScore={subjectConfig.maxPerTask?.[i] || 1}
                  value={formData.answers[i] || ''}
                  onChange={(value) => handleTaskChange(i, value)}
                  subject={formData.subject}
                  totalTasks={tasksCount}
                />
              ))}
            </div>
            <div className="primary-score">
              Первичный балл: {primaryScore}
              {maxScore > 0 && (
                <span className="score-max">/{maxScore}</span>
              )}
            </div>
          </div>
        )}

        <div className="form-group">
          <label>Комментарий</label>
          <textarea
            value={formData.comment}
            onChange={(e) => setFormData({ ...formData, comment: e.target.value })}
            rows="3"
            placeholder="Добавить комментарий к экзамену..."
          />
        </div>

        <div className="form-actions">
          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? 'Сохранение...' : exam ? 'Обновить' : 'Сохранить'}
          </button>
          <button type="button" onClick={onClose} className="btn btn-secondary">
            Отмена
          </button>
        </div>
      </form>
    </Modal>
  );
};

export default ExamForm;