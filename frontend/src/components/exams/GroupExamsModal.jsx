import React, { useState, useEffect, useMemo, useCallback } from 'react';
import axios from 'axios';
import Modal from '../common/Modal';
import { getSubjectDisplayName } from '../../utils/helpers';
import { SUBJECT_TASKS } from '../../services/constants';
import './GroupExamsModal.css';

const API_BASE = 'http://127.0.0.1:8000';

const GroupExamsModal = ({ group, allExams, onClose, showNotification }) => {

  // --------------------------------------------
  // INITIAL COMPUTATION (NO RE-EXECUTION)
  // --------------------------------------------
  const initialExams = useMemo(() => {
    if (!group) return [];
    const ids = group.students.map(s => s.id);
    return allExams.filter(ex => ids.includes(ex.id_student));
  }, [group, allExams]);

  const initialMainSubject = useMemo(() => {
    if (!group) return null;

    if (group.subject) return group.subject;

    const map = {};
    initialExams.forEach(e => {
      map[e.subject] = (map[e.subject] || 0) + 1;
    });

    return Object.keys(map).sort((a, b) => map[b] - map[a])[0] || null;
  }, [group, initialExams]);

  // --------------------------------------------
  // LOCAL STATE (ONLY UPDATED LOCALLY)
  // --------------------------------------------
  const [groupExams, setGroupExams] = useState(initialExams);
  const [mainSubject] = useState(initialMainSubject);
  const mainSubjectConfig = useMemo(() => SUBJECT_TASKS[mainSubject] || null, [mainSubject]);

  const tasksCount = mainSubjectConfig?.tasks || 0;

  const getExam = useCallback((studentId) => {
    return groupExams.find(e => e.id_student === studentId && e.subject === mainSubject) || null;
  }, [groupExams, mainSubject]);

  // --------------------------------------------
  // HELPERS
  // --------------------------------------------
  const calculatePrimaryScore = (answerString) => {
    if (!answerString) return 0;
    return answerString
      .split(',')
      .map(a => a.trim())
      .reduce((sum, val) => sum + (val !== '-' ? Number(val) || 0 : 0), 0);
  };

  // --------------------------------------------
  // UPDATE ANSWER
  // --------------------------------------------
  const handleTaskChange = async (examId, index, value) => {
    let clean = value.replace(/[^0-9-]/g, '');
    if (clean === '--') clean = '-';

    const max = mainSubjectConfig?.maxPerTask?.[index] || 1;
    if (clean !== '-' && Number(clean) > max) clean = String(max);

    const exam = groupExams.find(e => e.id === examId);
    if (!exam) return;

    const answers = exam.answer ? exam.answer.split(',').map(s => s.trim()) : [];
    while (answers.length < tasksCount) answers.push('-');
    answers[index] = clean;

    try {
      await axios.put(`${API_BASE}/exams/${examId}`, {
        answer: answers.join(',')
      });

      setGroupExams(prev =>
        prev.map(e => e.id === examId ? { ...e, answer: answers.join(',') } : e)
      );

      showNotification('Сохранено ✓', 'success');
    } catch (e) {
      console.error(e);
      showNotification('Ошибка сохранения', 'error');
    }
  };

  // --------------------------------------------
  // UPDATE COMMENT
  // --------------------------------------------
  const handleCommentChange = async (examId, comment) => {
    try {
      await axios.put(`${API_BASE}/exams/${examId}`, {
        comment: comment.trim() || null
      });

      setGroupExams(prev =>
        prev.map(e => e.id === examId ? { ...e, comment } : e)
      );

      showNotification('Комментарий сохранён ✓', 'success');
    } catch (e) {
      console.error(e);
      showNotification('Ошибка', 'error');
    }
  };

  // --------------------------------------------
  // ADD EXAM
  // --------------------------------------------
  const handleAddExam = async (studentId) => {
    const examData = {
      name: `Экзамен ${new Date().toLocaleDateString('ru-RU')}`,
      id_student: studentId,
      subject: mainSubject,
      answer: tasksCount ? Array(tasksCount).fill('-').join(',') : null,
      comment: null
    };

    try {
      const res = await axios.post(`${API_BASE}/exams/`, examData);

      setGroupExams(prev => [...prev, res.data]);

      showNotification('Экзамен добавлен ✓', 'success');
    } catch (e) {
      console.error(e);
      showNotification('Ошибка добавления', 'error');
    }
  };

  // --------------------------------------------
  // DELETE EXAM
  // --------------------------------------------
  const handleDeleteExam = async (examId) => {
    if (!window.confirm('Удалить экзамен?')) return;

    try {
      await axios.delete(`${API_BASE}/exams/${examId}`);

      setGroupExams(prev => prev.filter(e => e.id !== examId));

      showNotification('Удалён ✓', 'success');
    } catch (e) {
      console.error(e);
      showNotification('Ошибка удаления', 'error');
    }
  };

  // --------------------------------------------
  // RENDER
  // --------------------------------------------
  if (!group) return null;

  return (
    <Modal onClose={onClose} className="group-exams-modal-container">
      <div className="group-exams-modal">
        <div className="group-modal-header">
          <div>
            <h2>{group.name}</h2>
            <p className="teacher-info">👨‍🏫 {group.teacher}</p>
          </div>
          <button onClick={onClose} className="close-btn">×</button>
        </div>

        {!mainSubject ? (
          <div className="group-no-exams-state">
            <div className="group-no-exams-icon">📝</div>
            <h3>Нет основного предмета</h3>
            <p>Добавьте предмет в настройках</p>
          </div>
        ) : (
          <>
            <div className="subject-main-header">
              <h3>
                📖 {getSubjectDisplayName(mainSubject)}
                {tasksCount > 0 && (
                  <span className="tasks-count">({tasksCount} заданий)</span>
                )}
              </h3>
            </div>

            <div className="students-exams-container">
              {group.students.map(student => {
                const exam = getExam(student.id);
                const hasExam = !!exam;

                const answers = exam?.answer?.split(',').map(s => s.trim()) || [];
                const primary = hasExam ? calculatePrimaryScore(exam.answer) : 0;

                return (
                  <div key={student.id} className="student-exam-card">

                    <div className="student-exam-header">
                      <div className="student-info">
                        <strong>{student.fio}</strong>
                        {student.phone && (
                          <span className="student-phone">📱 {student.phone}</span>
                        )}
                      </div>

                      <div className="student-exam-actions">
                        {hasExam ? (
                          <>
                            <span className="primary-score">
                              Первичный балл: <strong>{primary}</strong>
                            </span>
                            <button
                              onClick={() => handleDeleteExam(exam.id)}
                              className="delete-exam-btn"
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

                    {hasExam ? (
                      <div className="student-exam-content">
                        {tasksCount > 0 && (
                          <div className="exam-tasks-section">
                            <div className="tasks-label">Ответы по заданиям:</div>

                            <div className="tasks-grid">
                              {Array.from({ length: tasksCount }).map((_, i) => (
                                <div key={i} className="task-item">
                                  <div className="task-number">{i + 1}</div>
                                  <input
                                    value={answers[i] || '-'}
                                    maxLength={2}
                                    onChange={(e) => handleTaskChange(exam.id, i, e.target.value)}
                                    className="task-input"
                                  />
                                  <div className="task-max">
                                    max: {mainSubjectConfig?.maxPerTask?.[i] || 1}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        <div className="exam-comment-section">
                          <div className="comment-label">💬 Комментарий:</div>
                          <textarea
                            value={exam.comment || ''}
                            onChange={(e) => handleCommentChange(exam.id, e.target.value)}
                            className="comment-textarea"
                            rows="3"
                          />
                        </div>
                      </div>
                    ) : (
                      <div className="no-exam-content">
                        <div className="no-exam-icon">📝</div>
                        <p>У студента нет экзамена</p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </Modal>
  );
};

export default GroupExamsModal;
