import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import { API_BASE, SUBJECT_TASKS } from '../services/constants';
import { calculateScoreForExam } from '../utils/calculations';
import PublicResultsCards from '../components/results/PublicResultsCards';
import '../styles/PublicResults.css';

const PublicResults = () => {
  const { token } = useParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [studentData, setStudentData] = useState(null);
  const [selectedExam, setSelectedExam] = useState(null);
  const [viewMode, setViewMode] = useState('bars'); // 'bars' или 'cards'
  const [showGoalModal, setShowGoalModal] = useState(false);
  const [goalValue, setGoalValue] = useState('');
  const [targetScore, setTargetScore] = useState(null);
  const [showDetails, setShowDetails] = useState(false);
  const [selectedSubjects, setSelectedSubjects] = useState({});

  // Блокировка скролла страницы при открытом модальном окне
  useEffect(() => {
    if (selectedExam || showGoalModal) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }

    // Очистка при размонтировании
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [selectedExam, showGoalModal]);

  useEffect(() => {
    const fetchResults = async () => {
      try {
        setLoading(true);
        setError(null);

        const response = await axios.get(`${API_BASE}/public/results/${token}`);
        setStudentData(response.data);

        // Инициализируем выбранные предметы (по умолчанию - последние экзамены)
        if (response.data.exams && response.data.exams.length > 0) {
          const examsBySubject = {};
          response.data.exams.forEach(exam => {
            if (!examsBySubject[exam.subject]) {
              examsBySubject[exam.subject] = [];
            }
            examsBySubject[exam.subject].push(exam);
          });

          const initialSelected = {};
          Object.keys(examsBySubject).forEach(subject => {
            const exams = examsBySubject[subject];
            exams.sort((a, b) => b.id - a.id);
            initialSelected[subject] = exams[0].id;
          });
          setSelectedSubjects(initialSelected);
        }

        // Загружаем цель из localStorage
        const savedGoal = localStorage.getItem(`goal_${token}`);
        if (savedGoal) {
          setTargetScore(parseInt(savedGoal));
        }
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

  // Функция для вычисления текущего суммарного балла с деталями
  const calculateTotalScoreWithDetails = () => {
    if (!studentData?.exams || studentData.exams.length === 0) {
      return { total: 0, details: [] };
    }

    // Используем выбранные экзамены или последние по умолчанию
    let latestExams = {};

    if (Object.keys(selectedSubjects).length > 0) {
      // Используем выбранные экзамены
      studentData.exams.forEach(exam => {
        if (selectedSubjects[exam.subject] === exam.id) {
          latestExams[exam.subject] = exam;
        }
      });
    } else {
      // Используем последние экзамены по умолчанию
      const examsBySubject = {};
      studentData.exams.forEach(exam => {
        if (!examsBySubject[exam.subject]) {
          examsBySubject[exam.subject] = [];
        }
        examsBySubject[exam.subject].push(exam);
      });

      Object.keys(examsBySubject).forEach(subject => {
        const exams = examsBySubject[subject];
        exams.sort((a, b) => b.id - a.id);
        latestExams[subject] = exams[0];
      });
    }

    // Функция для получения итогового балла
    const getFinalScore = (exam) => {
      const score = getScoreDisplay(exam);
      // Проверяем наличие итогового балла (secondary)
      const secondaryScore = parseFloat(score.secondary);
      const primaryScore = parseFloat(score.primary);

      // Если итоговый балл существует и это число > 0, используем его
      if (!isNaN(secondaryScore) && secondaryScore > 0) {
        return { value: secondaryScore, type: 'итоговый', primary: primaryScore, secondary: secondaryScore };
      }
      // Иначе используем первичный балл
      const value = !isNaN(primaryScore) ? primaryScore : 0;
      return { value, type: 'первичный', primary: primaryScore, secondary: secondaryScore };
    };

    // Определяем основные предметы в зависимости от того, ЕГЭ или ОГЭ
    const allSubjects = Object.keys(latestExams);
    const isOGE = allSubjects.some(s => s.endsWith('_9'));

    // Основные предметы для ЕГЭ и ОГЭ
    const mainSubjectsEGE = ['rus', 'math_profile', 'math_base'];
    const mainSubjectsOGE = ['rus_9', 'math_9'];
    const mainSubjects = isOGE ? mainSubjectsOGE : mainSubjectsEGE;

    let totalScore = 0;
    const details = [];

    // Суммируем баллы по основным предметам
    // Для ЕГЭ: проверяем и rus, и math_profile/math_base
    // Для ОГЭ: проверяем rus_9 и math_9
    const addedMainSubjects = [];

    mainSubjects.forEach(subject => {
      if (latestExams[subject]) {
        const exam = latestExams[subject];
        const scoreInfo = getFinalScore(exam);
        const subjectConfig = SUBJECT_TASKS[subject];
        totalScore += scoreInfo.value;
        addedMainSubjects.push(subject);
        details.push({
          subject: subjectConfig?.name || subject,
          exam: exam.name,
          score: scoreInfo.value,
          type: scoreInfo.type,
          primary: scoreInfo.primary,
          secondary: scoreInfo.secondary,
          isMain: true
        });
      }
    });

    // Находим максимальный балл среди предметов по выбору
    // Исключаем только те основные предметы, которые были добавлены
    const electiveSubjects = Object.keys(latestExams).filter(
      subject => !addedMainSubjects.includes(subject)
    );

    let maxElectiveScore = 0;
    let maxElectiveSubject = null;
    let maxElectiveInfo = null;

    electiveSubjects.forEach(subject => {
      const exam = latestExams[subject];
      const scoreInfo = getFinalScore(exam);
      if (scoreInfo.value > maxElectiveScore) {
        maxElectiveScore = scoreInfo.value;
        maxElectiveSubject = subject;
        maxElectiveInfo = { exam, scoreInfo };
      }
    });

    if (maxElectiveSubject) {
      const subjectConfig = SUBJECT_TASKS[maxElectiveSubject];
      totalScore += maxElectiveScore;
      details.push({
        subject: subjectConfig?.name || maxElectiveSubject,
        exam: maxElectiveInfo.exam.name,
        score: maxElectiveInfo.scoreInfo.value,
        type: maxElectiveInfo.scoreInfo.type,
        primary: maxElectiveInfo.scoreInfo.primary,
        secondary: maxElectiveInfo.scoreInfo.secondary,
        isMain: false,
        isElective: true
      });
    }

    return { total: totalScore, details };
  };

  const calculateTotalScore = () => {
    return calculateTotalScoreWithDetails().total;
  };

  // Функция для сохранения цели
  const handleSaveGoal = () => {
    const goal = parseInt(goalValue);
    if (goal && goal > 0) {
      setTargetScore(goal);
      localStorage.setItem(`goal_${token}`, goal.toString());
      setShowGoalModal(false);
      setGoalValue('');
    }
  };

  // Функция для отмены модального окна
  const handleCancelGoal = () => {
    setShowGoalModal(false);
    setGoalValue('');
  };

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

  const scoreData = calculateTotalScoreWithDetails();
  const currentScore = scoreData.total;
  const progressPercentage = targetScore ? Math.min((currentScore / targetScore) * 100, 100) : 0;
  const remainingScore = targetScore ? Math.max(targetScore - currentScore, 0) : 0;

  return (
    <div className="public-results-container">
      <div className="public-results-header-new">
        <div className="header-top-row">
          <div className="header-text-block">
            <h1 className="header-title">Прогресс подготовки</h1>
            <p className="header-student-name">{studentData.fio}</p>
          </div>

          <div className="header-controls">
            <button
              className="goal-button"
              onClick={() => setShowGoalModal(true)}
              title="Поставить цель"
            >
              <span className="goal-button-icon">+</span>
              <span className="goal-button-text">Поставить цель</span>
            </button>

            <div className="public-view-toggle">
              <button
                className={`public-toggle-btn ${viewMode === 'bars' ? 'active' : ''}`}
                onClick={() => setViewMode('bars')}
                title="Столбцы"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="3" width="7" height="18" />
                  <rect x="14" y="8" width="7" height="13" />
                </svg>
              </button>
              <button
                className={`public-toggle-btn ${viewMode === 'cards' ? 'active' : ''}`}
                onClick={() => setViewMode('cards')}
                title="Карточки"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="3" width="7" height="7" />
                  <rect x="14" y="3" width="7" height="7" />
                  <rect x="3" y="14" width="7" height="7" />
                  <rect x="14" y="14" width="7" height="7" />
                </svg>
              </button>
            </div>
          </div>
        </div>

        {targetScore && (
          <div className="progress-section">
            <div className="progress-bar-container">
              <div
                className="progress-bar-fill"
                style={{ width: `${progressPercentage}%` }}
              >
                <span className="progress-percentage">{Math.round(progressPercentage)}%</span>
              </div>
            </div>
            <div className="progress-info">
              <span className="current-score">Текущий балл: {Math.round(currentScore)}</span>
              <span className="remaining-score">
                До цели ({targetScore} баллов) осталось {Math.round(remainingScore)} баллов
              </span>
            </div>

            {/* Кнопка раскрытия деталей */}
            <div className="details-toggle-container">
              <button
                className="details-toggle-btn"
                onClick={() => setShowDetails(!showDetails)}
              >
                {showDetails ? '▼ Скрыть детали' : '▶ Показать детали расчета'}
              </button>
            </div>

            {/* Детали расчета */}
            {showDetails && (
              <div className="score-details">
                <h4 className="score-details-title">
                  Учитываются в расчете:
                </h4>

                {/* Селекторы предметов */}
                <div className="subject-selectors">
                  {Object.entries(groupExamsBySubject(studentData.exams)).map(([subject, exams]) => {
                    const subjectConfig = SUBJECT_TASKS[subject];
                    return (
                      <div key={subject} className="subject-selector">
                        <label className="subject-selector-label">
                          {subjectConfig?.name || subject}:
                        </label>
                        <select
                          className="subject-selector-dropdown"
                          value={selectedSubjects[subject] || ''}
                          onChange={(e) => {
                            setSelectedSubjects({
                              ...selectedSubjects,
                              [subject]: parseInt(e.target.value)
                            });
                          }}
                        >
                          {exams.map(exam => (
                            <option key={exam.id} value={exam.id}>
                              {exam.name || `Экзамен ${exam.id}`}
                            </option>
                          ))}
                        </select>
                      </div>
                    );
                  })}
                </div>

                {/* Детали баллов */}
                <div className="score-details-list">
                  {scoreData.details.map((detail, index) => (
                    <div key={index} className="score-detail-item">
                      <span className="detail-subject">
                        <strong>{detail.subject}</strong> ({detail.exam})
                        {detail.isElective && <span className="detail-badge"> [выбор]</span>}
                      </span>
                      <span className="detail-score">
                        {detail.score} ({detail.type})
                        {detail.secondary && detail.secondary !== detail.primary && (
                          <span className="detail-primary">
                            (перв: {detail.primary})
                          </span>
                        )}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {studentData.exams && studentData.exams.length > 0 ? (
        <>
          {viewMode === 'bars' ? (
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
            <>
              <PublicResultsCards
                exams={studentData.exams}
                onExamClick={setSelectedExam}
              />
              <p className="chart-hint">Нажмите на карточку, чтобы увидеть детальные результаты</p>
            </>
          )}
        </>
      ) : (
        <div className="no-exams-message">
          <p>Результаты экзаменов пока не добавлены.</p>
        </div>
      )}

      {selectedExam && (
        <div className="modal-overlay" onClick={() => setSelectedExam(null)}>
          <div className="modal-content minimalist" onClick={(e) => e.stopPropagation()}>
            {(() => {
              const score = getScoreDisplay(selectedExam);
              const subjectConfig = SUBJECT_TASKS[selectedExam.subject];
              const answersTable = parseAnswersToTable(selectedExam.answer, selectedExam.subject);

              // Функция для определения цвета задания
              const getTaskColor = (taskScore, maxScore) => {
                if (taskScore === 0) return '#EF4444'; // Красный
                if (taskScore === maxScore) return '#10B981'; // Зеленый
                return '#F59E0B'; // Желтый/Оранжевый
              };

              return (
                <>
                  {/* Шапка */}
                  <div className="modal-header minimalist">
                    <div className="modal-header-content">
                      <h3 className="modal-title">{subjectConfig?.name || selectedExam.subject}</h3>
                      <p className="modal-subtitle">{selectedExam.name || 'Экзамен'}</p>
                    </div>
                    <button className="modal-close minimalist" onClick={() => setSelectedExam(null)}>
                      ✕
                    </button>
                  </div>

                  {/* Тело */}
                  <div className="modal-body minimalist">
                    {/* Сводка баллов */}
                    <div className="modal-score-summary">
                      <div className="score-block">
                        <div className="score-value">{score.primary}</div>
                        <div className="score-label">первичный</div>
                      </div>
                      {score.secondary && (
                        <>
                          <div className="score-divider"></div>
                          <div className="score-block accent">
                            <div className="score-value">{score.secondary}</div>
                            <div className="score-label">тестовый</div>
                          </div>
                        </>
                      )}
                    </div>

                    {/* Таблица результатов */}
                    {answersTable.length > 0 && (
                      <div className="modal-tasks-section">
                        <h4 className="tasks-title">Результаты по заданиям</h4>
                        <div className="tasks-two-columns">
                          {/* Левая колонка */}
                          <div className="tasks-table-wrapper">
                            <table className="tasks-table">
                              <tbody>
                                {answersTable.slice(0, Math.ceil(answersTable.length / 2)).map((task) => {
                                  const taskColor = getTaskColor(task.score, task.maxScore);
                                  return (
                                    <tr key={task.taskNumber}>
                                      <td className="task-number-cell">№{task.taskNumber}</td>
                                      <td className="task-score-cell" style={{ color: taskColor }}>
                                        {task.score} / {task.maxScore}
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>

                          {/* Правая колонка */}
                          <div className="tasks-table-wrapper">
                            <table className="tasks-table">
                              <tbody>
                                {answersTable.slice(Math.ceil(answersTable.length / 2)).map((task) => {
                                  const taskColor = getTaskColor(task.score, task.maxScore);
                                  return (
                                    <tr key={task.taskNumber}>
                                      <td className="task-number-cell">№{task.taskNumber}</td>
                                      <td className="task-score-cell" style={{ color: taskColor }}>
                                        {task.score} / {task.maxScore}
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Футер */}
                  <div className="modal-footer minimalist">
                    <button className="modal-action-btn">Подробный отчет</button>
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      )}

      <div className="public-results-footer">
        <p>Если вы заметили ошибку в результатах, обратитесь к администратору.</p>
      </div>

      {/* Модальное окно для установки цели */}
      {showGoalModal && (
        <div className="modal-overlay" onClick={handleCancelGoal}>
          <div className="modal-content goal-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Установить целевой балл</h3>
              <button className="modal-close" onClick={handleCancelGoal}>
                ✕
              </button>
            </div>
            <div className="modal-body">
              <p className="goal-modal-description">
                Укажите желаемое количество баллов, которое хотите набрать
              </p>
              <input
                type="number"
                className="goal-input"
                placeholder="Например: 280"
                value={goalValue}
                onChange={(e) => setGoalValue(e.target.value)}
                min="1"
                autoFocus
              />
              <div className="goal-modal-actions">
                <button className="goal-cancel-btn" onClick={handleCancelGoal}>
                  Отмена
                </button>
                <button
                  className="goal-save-btn"
                  onClick={handleSaveGoal}
                  disabled={!goalValue || parseInt(goalValue) <= 0}
                >
                  Сохранить
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PublicResults;
