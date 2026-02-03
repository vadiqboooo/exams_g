import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import { API_BASE, SUBJECT_TASKS } from '../services/constants';
import { calculateScoreForExam } from '../utils/calculations';
import '../styles/PublicResults.css';

const PublicResults = () => {
  const { token } = useParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [studentData, setStudentData] = useState(null);
  const [selectedExam, setSelectedExam] = useState(null);

  useEffect(() => {
    const fetchResults = async () => {
      try {
        setLoading(true);
        setError(null);

        const response = await axios.get(`${API_BASE}/public/results/${token}`);
        setStudentData(response.data);
      } catch (err) {
        setError(err.response?.data?.detail || err.message || 'Не удалось загрузить результаты');
      } finally {
        setLoading(false);
      }
    };

    if (token) {
      fetchResults();
    }
  }, [token]);

  const getScoreDisplay = (exam) => {
    try {
      const subjectConfig = SUBJECT_TASKS[exam.subject];
      if (!subjectConfig) {
        return { primary: '-', secondary: '' };
      }

      const score = calculateScoreForExam(exam.answer, exam.subject);

      return {
        primary: score.primary,
        secondary: score.secondary
      };
    } catch {
      return { primary: '-', secondary: '' };
    }
  };

  const parseAnswersToTable = (answer, subject) => {
    if (!answer || !answer.trim()) {
      return [];
    }

    const subjectConfig = SUBJECT_TASKS[subject];
    if (!subjectConfig) {
      return [];
    }

    const answers = answer.split(/[,\s]+/).map(s => s.trim()).filter(s => s);
    const maxPerTask = subjectConfig.maxPerTask || [];

    return answers.map((score, index) => ({
      taskNumber: index + 1,
      score: score === '-' ? 0 : parseInt(score) || 0,
      maxScore: maxPerTask[index] || 1
    }));
  };

  const getBarColor = (percentage) => {
    if (percentage >= 80) return '#4CAF50'; // Зеленый
    if (percentage >= 60) return '#2196F3'; // Синий
    if (percentage >= 40) return '#FF9800'; // Оранжевый
    return '#F44336'; // Красный
  };

  const groupExamsBySubject = (exams) => {
    const grouped = {};
    exams.forEach(exam => {
      if (!grouped[exam.subject]) {
        grouped[exam.subject] = [];
      }
      grouped[exam.subject].push(exam);
    });
    return grouped;
  };

  if (loading) {
    return (
      <div className="public-results-container">
        <div className="loading-message">Загрузка результатов...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="public-results-container">
        <div className="error-message">
          <h2>Ошибка</h2>
          <p>{error}</p>
          <p className="error-hint">Проверьте правильность ссылки или обратитесь к администратору.</p>
        </div>
      </div>
    );
  }

  if (!studentData) {
    return (
      <div className="public-results-container">
        <div className="error-message">
          <h2>Результаты не найдены</h2>
          <p>Не удалось найти результаты по указанной ссылке.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="public-results-container">
      <div className="public-results-header">
        <h1>Результаты экзаменов</h1>
        <h2>{studentData.fio}</h2>
      </div>

      {studentData.exams && studentData.exams.length > 0 ? (
        <div className="chart-container">
          {Object.entries(groupExamsBySubject(studentData.exams)).map(([subject, exams]) => {
            const subjectConfig = SUBJECT_TASKS[subject];
            return (
              <div key={subject} className="subject-group">
                <h3 className="subject-group-title">{subjectConfig?.name || subject}</h3>
                <div className="chart-bars">
                  {exams.map((exam) => {
                    const score = getScoreDisplay(exam);
                    const displayScore = score.secondary || score.primary;
                    const maxScore = score.secondary ? 100 : (subjectConfig?.maxPerTask?.reduce((a, b) => a + b, 0) || 100);
                    const percentage = (parseFloat(displayScore) / maxScore) * 100;
                    const barColor = getBarColor(percentage);

                    return (
                      <div
                        key={exam.id}
                        className="chart-bar"
                        onClick={() => setSelectedExam(exam)}
                        style={{ cursor: 'pointer' }}
                      >
                        <div className="bar-container">
                          <div
                            className="bar-fill"
                            style={{
                              width: `${Math.max(percentage, 15)}%`,
                              backgroundColor: barColor
                            }}
                          >
                            <span className="bar-label">
                              {exam.name || 'Экзамен'}
                            </span>
                            <span className="bar-score">{displayScore}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
          <p className="chart-hint">Нажмите на столбец, чтобы увидеть детальные результаты</p>
        </div>
      ) : (
        <div className="no-exams-message">
          <p>Результаты экзаменов пока не добавлены.</p>
        </div>
      )}

      {selectedExam && (
        <div className="modal-overlay" onClick={() => setSelectedExam(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{SUBJECT_TASKS[selectedExam.subject]?.name || selectedExam.subject}</h3>
              <button className="modal-close" onClick={() => setSelectedExam(null)}>
                ✕
              </button>
            </div>
            <div className="modal-body">
              {(() => {
                const score = getScoreDisplay(selectedExam);
                const subjectConfig = SUBJECT_TASKS[selectedExam.subject];
                const answersTable = parseAnswersToTable(selectedExam.answer, selectedExam.subject);

                return (
                  <>
                    {selectedExam.name && (
                      <div className="modal-exam-name">
                        {selectedExam.name}
                      </div>
                    )}

                    <div className="modal-scores">
                      <div className="modal-score-item">
                        <span className="modal-score-label">Первичный балл:</span>
                        <span className="modal-score-value">{score.primary}</span>
                      </div>
                      {score.secondary && (
                        <div className="modal-score-item">
                          <span className="modal-score-label">Тестовый балл:</span>
                          <span className="modal-score-value secondary">{score.secondary}</span>
                        </div>
                      )}
                    </div>

                    {answersTable.length > 0 && (
                      <div className="modal-table">
                        <h4>Результаты по заданиям:</h4>
                        <div className="answers-table-container">
                          <table className="answers-table">
                            <thead>
                              <tr>
                                <th>№</th>
                                <th>Балл</th>
                                <th>Макс.</th>
                              </tr>
                            </thead>
                            <tbody>
                              {answersTable.map((task) => (
                                <tr key={task.taskNumber}>
                                  <td className="task-number-col">{task.taskNumber}</td>
                                  <td className="task-score-col">{task.score}</td>
                                  <td className="task-max-col">{task.maxScore}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </>
                );
              })()}
            </div>
          </div>
        </div>
      )}

      <div className="public-results-footer">
        <p>Если вы заметили ошибку в результатах, обратитесь к администратору.</p>
      </div>
    </div>
  );
};

export default PublicResults;
