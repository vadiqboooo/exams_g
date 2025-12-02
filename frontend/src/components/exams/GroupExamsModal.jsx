import React, { useState, useMemo, useCallback } from 'react';
import axios from 'axios';
import Modal from '../common/Modal';
import { getSubjectDisplayName } from '../../utils/helpers';
import { SUBJECT_TASKS } from '../../services/constants';
import './GroupExamsModal.css';
import './GroupExamsDetailsModal.css'; // Добавьте эту строку

const API_BASE = 'http://127.0.0.1:8000';

const GroupExamsModal = ({ 
  group, 
  allExams, 
  examTitle, // Название экзамена
  onClose, 
  onBack, // Функция для возврата к списку экзаменов
  showNotification 
}) => {
  // Фильтруем экзамены по названию для выбранной группы
  const filteredExams = useMemo(() => {
    if (!group || !allExams || !examTitle) return [];
    
    const groupStudentIds = group.students?.map(s => s.id) || [];
    return allExams.filter(exam => 
      groupStudentIds.includes(exam.id_student) && 
      (exam.name === examTitle || (!exam.name && examTitle === 'Без названия'))
    );
  }, [group, allExams, examTitle]);

  // Определяем основной предмет по отфильтрованным экзаменам
  const mainSubject = useMemo(() => {
    if (!filteredExams.length) return null;
    
    const subjectCounts = {};
    filteredExams.forEach(exam => {
      if (exam.subject) {
        subjectCounts[exam.subject] = (subjectCounts[exam.subject] || 0) + 1;
      }
    });
    
    const subjects = Object.keys(subjectCounts);
    if (subjects.length === 0) return null;
    
    return subjects.sort((a, b) => 
      subjectCounts[b] - subjectCounts[a]
    )[0];
  }, [filteredExams]);

  const mainSubjectConfig = useMemo(() => 
    mainSubject ? SUBJECT_TASKS[mainSubject] || null : null, 
    [mainSubject]
  );
  
  const tasksCount = mainSubjectConfig?.tasks || 0;

  // Получаем экзамен для конкретного студента
  const getExam = useCallback((studentId) => {
    return filteredExams.find(e => e.id_student === studentId) || null;
  }, [filteredExams]);

  // Вычисляем первичный балл
  const calculatePrimaryScore = (answerString) => {
    if (!answerString) return 0;
    return answerString
      .split(',')
      .map(a => a.trim())
      .reduce((sum, val) => sum + (val !== '-' ? Number(val) || 0 : 0), 0);
  };

  // Обработка изменения ответа на задание
  const handleTaskChange = async (examId, index, value) => {
    let clean = value.replace(/[^0-9-]/g, '');
    if (clean === '--') clean = '-';

    const max = mainSubjectConfig?.maxPerTask?.[index] || 1;
    if (clean !== '-' && Number(clean) > max) clean = String(max);

    const exam = filteredExams.find(e => e.id === examId);
    if (!exam) return;

    const answers = exam.answer ? exam.answer.split(',').map(s => s.trim()) : [];
    while (answers.length < tasksCount) answers.push('-');
    answers[index] = clean;

    try {
      await axios.put(`${API_BASE}/exams/${examId}`, {
        answer: answers.join(',')
      });

      showNotification('Сохранено ✓', 'success');
      
      // После сохранения нужно обновить данные
      onClose(true); // Передаем флаг обновления
    } catch (e) {
      console.error(e);
      showNotification('Ошибка сохранения', 'error');
    }
  };

  // Обработка изменения комментария
  const handleCommentChange = async (examId, comment) => {
    try {
      await axios.put(`${API_BASE}/exams/${examId}`, {
        comment: comment.trim() || null
      });

      showNotification('Комментарий сохранён ✓', 'success');
      
      // После сохранения нужно обновить данные
      onClose(true); // Передаем флаг обновления
    } catch (e) {
      console.error(e);
      showNotification('Ошибка сохранения комментария', 'error');
    }
  };

  // Добавление нового экзамена для студента
  const handleAddExam = async (studentId) => {
    if (!mainSubject) {
      showNotification('Не выбран предмет для экзамена', 'error');
      return;
    }

    const examData = {
      name: examTitle,
      id_student: studentId,
      subject: mainSubject,
      answer: tasksCount > 0 ? Array(tasksCount).fill('-').join(',') : null,
      comment: null
    };

    try {
      const res = await axios.post(`${API_BASE}/exams/`, examData);
      showNotification('Экзамен добавлен ✓', 'success');
      
      // После добавления нужно обновить данные
      onClose(true); // Передаем флаг обновления
    } catch (e) {
      console.error(e);
      showNotification('Ошибка добавления экзамена', 'error');
    }
  };

  // Удаление экзамена
  const handleDeleteExam = async (examId) => {
    if (!window.confirm('Удалить этот экзамен? Все результаты будут потеряны.')) return;

    try {
      await axios.delete(`${API_BASE}/exams/${examId}`);
      showNotification('Экзамен удалён ✓', 'success');
      
      // После удаления нужно обновить данные
      onClose(true); // Передаем флаг обновления
    } catch (e) {
      console.error(e);
      showNotification('Ошибка удаления экзамена', 'error');
    }
  };

  // Статистика по экзамену
  const examStats = useMemo(() => {
    const totalStudents = group?.students?.length || 0;
    const studentsWithExam = filteredExams.length;
    const studentsWithoutExam = totalStudents - studentsWithExam;
    
    // Средний балл
    let totalScore = 0;
    let scoredExams = 0;
    
    filteredExams.forEach(exam => {
      const score = calculatePrimaryScore(exam.answer);
      if (score > 0) {
        totalScore += score;
        scoredExams++;
      }
    });
    
    const averageScore = scoredExams > 0 ? (totalScore / scoredExams).toFixed(1) : 0;
    
    return {
      totalStudents,
      studentsWithExam,
      studentsWithoutExam,
      averageScore,
      completionRate: totalStudents > 0 ? Math.round((studentsWithExam / totalStudents) * 100) : 0
    };
  }, [group, filteredExams]);

  if (!group || !examTitle) return null;

  // Сортируем студентов по ФИО
  const sortedStudents = useMemo(() => {
    if (!group.students) return [];
    return [...group.students].sort((a, b) => 
      a.fio?.localeCompare(b.fio) || 0
    );
  }, [group.students]);

  return (
    <Modal onClose={() => onClose(false)} className="group-exams-modal-container">
      <div className="group-exams-modal">
        {/* Заголовок с навигацией */}
        <div className="group-modal-header">
          <div>
            <button 
              onClick={onBack}
              className="back-btn"
            >
              ← Назад к списку
            </button>
            <h2 className="exam-title-header">
              <span className="exam-icon">📋</span>
              {examTitle}
            </h2>
            <div className="exam-header-info">
              <span className="teacher-info">👨‍🏫 {group.teacher}</span>
              {group.name && <span className="group-info">👥 {group.name}</span>}
            </div>
          </div>
          <button onClick={() => onClose(false)} className="close-btn">×</button>
        </div>

        {/* Статистика экзамена */}
        <div className="exam-stats-container">
          <div className="exam-stat-card">
            <div className="stat-value">{examStats.totalStudents}</div>
            <div className="stat-label">Всего студентов</div>
          </div>
          <div className="exam-stat-card">
            <div className="stat-value" style={{ color: '#10b981' }}>
              {examStats.studentsWithExam}
            </div>
            <div className="stat-label">Сдали экзамен</div>
          </div>
          <div className="exam-stat-card">
            <div className="stat-value" style={{ color: examStats.studentsWithoutExam > 0 ? '#ef4444' : '#6b7280' }}>
              {examStats.studentsWithoutExam}
            </div>
            <div className="stat-label">Не сдали</div>
          </div>
          <div className="exam-stat-card">
            <div className="stat-value" style={{ color: '#3b82f6' }}>
              {examStats.averageScore}
            </div>
            <div className="stat-label">Средний балл</div>
          </div>
          <div className="exam-stat-card">
            <div className="stat-value" style={{ color: examStats.completionRate >= 80 ? '#10b981' : '#f59e0b' }}>
              {examStats.completionRate}%
            </div>
            <div className="stat-label">Выполнение</div>
          </div>
        </div>

        {/* Основной предмет */}
        {mainSubject ? (
          <div className="subject-main-header">
            <h3>
              <span className="subject-icon">📖</span>
              {getSubjectDisplayName(mainSubject)}
              {tasksCount > 0 && (
                <span className="tasks-count">({tasksCount} заданий)</span>
              )}
            </h3>
            <div className="subject-actions">
              <span className="total-exams-count">
                Работ: <strong>{filteredExams.length}</strong>
              </span>
            </div>
          </div>
        ) : (
          <div className="no-subject-warning">
            <div className="warning-icon">⚠️</div>
            <div>
              <h4>Предмет не указан</h4>
              <p>Укажите предмет в настройках экзамена</p>
            </div>
          </div>
        )}

        {/* Список студентов с экзаменами */}
        <div className="students-exams-container">
          {sortedStudents.length === 0 ? (
            <div className="no-students-state">
              <div className="no-students-icon">👥</div>
              <h3>Нет студентов в группе</h3>
              <p>Добавьте студентов в группу</p>
            </div>
          ) : (
            sortedStudents.map(student => {
              const exam = getExam(student.id);
              const hasExam = !!exam;

              const answers = exam?.answer?.split(',').map(s => s.trim()) || [];
              const primaryScore = hasExam ? calculatePrimaryScore(exam.answer) : 0;

              return (
                <div key={student.id} className="student-exam-card">
                  {/* Заголовок карточки студента */}
                  <div className="student-exam-header">
                    <div className="student-info">
                      <div className="student-name">
                        <strong>{student.fio || `Студент #${student.id}`}</strong>
                        {student.phone && (
                          <span className="student-phone">📱 {student.phone}</span>
                        )}
                      </div>
                      {student.email && (
                        <div className="student-email">✉️ {student.email}</div>
                      )}
                    </div>

                    <div className="student-exam-actions">
                      {hasExam ? (
                        <>
                          <div className="exam-score-info">
                            <span className="primary-score-label">Первичный балл:</span>
                            <span className="primary-score-value">
                              <strong>{primaryScore}</strong>
                              {tasksCount > 0 && (
                                <span className="score-max">
                                  /{mainSubjectConfig?.maxScore || tasksCount}
                                </span>
                              )}
                            </span>
                          </div>
                          <button
                            onClick={() => handleDeleteExam(exam.id)}
                            className="delete-exam-btn"
                            title="Удалить экзамен"
                          >
                            🗑️ Удалить
                          </button>
                        </>
                      ) : (
                        <button
                          onClick={() => handleAddExam(student.id)}
                          className="add-exam-btn"
                        >
                          ➕ Добавить экзамен
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Содержимое карточки студента */}
                  {hasExam ? (
                    <div className="student-exam-content">
                      {/* Задания экзамена */}
                      {tasksCount > 0 && (
                        <div className="exam-tasks-section">
                          <div className="tasks-header">
                            <div className="tasks-label">Ответы по заданиям:</div>
                            <div className="tasks-total">
                              Всего заданий: <strong>{tasksCount}</strong>
                            </div>
                          </div>
                          
                          <div className="tasks-grid">
                            {Array.from({ length: tasksCount }).map((_, i) => (
                              <div key={i} className="task-item">
                                <div className="task-header">
                                  <div className="task-number">№{i + 1}</div>
                                  <div className="task-max-label">
                                    макс: {mainSubjectConfig?.maxPerTask?.[i] || 1}
                                  </div>
                                </div>
                                <input
                                  value={answers[i] || '-'}
                                  maxLength={3}
                                  onChange={(e) => handleTaskChange(exam.id, i, e.target.value)}
                                  className="task-input"
                                  placeholder="-"
                                />
                                <div className="task-score">
                                  {answers[i] !== '-' && answers[i] !== '' 
                                    ? `+${answers[i]}` 
                                    : '—'
                                  }
                                </div>
                              </div>
                            ))}
                          </div>
                          
                          <div className="tasks-summary">
                            <div className="total-score">
                              Итоговый балл: <strong>{primaryScore}</strong>
                              {mainSubjectConfig?.maxScore && (
                                <span> из {mainSubjectConfig.maxScore}</span>
                              )}
                            </div>
                            {primaryScore > 0 && mainSubjectConfig?.maxScore && (
                              <div className="score-percentage">
                                {Math.round((primaryScore / mainSubjectConfig.maxScore) * 100)}%
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Комментарий */}
                      <div className="exam-comment-section">
                        <div className="comment-header">
                          <div className="comment-label">
                            <span className="comment-icon">💬</span>
                            Комментарий преподавателя:
                          </div>
                          {exam.comment && (
                            <span className="comment-length">
                              {exam.comment.length} симв.
                            </span>
                          )}
                        </div>
                        <textarea
                          value={exam.comment || ''}
                          onChange={(e) => handleCommentChange(exam.id, e.target.value)}
                          className="comment-textarea"
                          rows="3"
                          placeholder="Введите комментарий к работе студента..."
                        />
                        {exam.comment && (
                          <div className="comment-actions">
                            <span className="comment-hint">
                              Комментарий сохранён автоматически
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Информация об экзамене */}
                      <div className="exam-meta-info">
                        <span className="exam-id">ID: {exam.id}</span>
                        <span className="exam-date">
                          {exam.created_at 
                            ? new Date(exam.created_at).toLocaleDateString('ru-RU')
                            : 'Дата не указана'
                          }
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div className="no-exam-content">
                      <div className="no-exam-icon">📝</div>
                      <div className="no-exam-text">
                        <h4>Нет экзамена</h4>
                        <p>У студента нет этого экзамена</p>
                      </div>
                      <button
                        onClick={() => handleAddExam(student.id)}
                        className="add-exam-btn-small"
                      >
                        ➕ Добавить
                      </button>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Подвал модального окна */}
        <div className="exam-modal-footer">
          <div className="footer-actions">
            <button
              onClick={onBack}
              className="btn btn-outline"
            >
              ← К списку экзаменов
            </button>
            <div className="footer-info">
              <span className="last-updated">
                Данные обновлены: {new Date().toLocaleTimeString('ru-RU')}
              </span>
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
};

export default GroupExamsModal;