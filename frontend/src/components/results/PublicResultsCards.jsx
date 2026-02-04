import React from 'react';
import { SUBJECT_TASKS } from '../../services/constants';
import { calculateScoreForExam } from '../../utils/calculations';
import './PublicResultsCards.css';

const PublicResultsCards = ({ exams, onExamClick }) => {
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

  // Функция для получения максимального балла
  const getMaxScore = (subject) => {
    const subjectConfig = SUBJECT_TASKS[subject];
    if (!subjectConfig?.maxPerTask) return 100;

    if (subject === 'infa_9') {
      let sum = 0;
      for (let i = 0; i < 12 && i < subjectConfig.maxPerTask.length; i++) {
        sum += subjectConfig.maxPerTask[i] || 0;
      }
      if (subjectConfig.maxPerTask.length > 13) {
        sum += Math.max(subjectConfig.maxPerTask[12] || 0, subjectConfig.maxPerTask[13] || 0);
      }
      if (subjectConfig.maxPerTask.length > 14) {
        sum += subjectConfig.maxPerTask[14] || 0;
      }
      for (let i = 15; i < subjectConfig.maxPerTask.length; i++) {
        sum += subjectConfig.maxPerTask[i] || 0;
      }
      return sum;
    }

    return subjectConfig.maxPerTask.reduce((sum, max) => sum + max, 0);
  };

  // Функция для получения цвета в зависимости от балла
  const getScoreColor = (primaryScore, maxScore) => {
    if (maxScore === 0) return '#9CA3AF';
    const percentage = (primaryScore / maxScore) * 100;

    if (percentage >= 60) return '#3B82F6'; // Синий
    if (percentage >= 40) return '#F59E0B'; // Оранжевый
    return '#EF4444'; // Красный
  };

  // Функция для получения иконки предмета
  const getSubjectIcon = (subject) => {
    const icons = {
      math_9: '📐',
      infa_9: '💻',
      russian_9: '📚',
      chemistry_9: '🧪',
      physics_9: '⚛️',
      biology_9: '🧬',
      history_9: '📜',
      geography_9: '🌍',
      english_9: '🇬🇧',
      social_9: '👥'
    };
    return icons[subject] || '📖';
  };

  // Группируем экзамены по предметам
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

  const groupedExams = groupExamsBySubject(exams);

  return (
    <div className="public-results-cards-container">
      {Object.entries(groupedExams).map(([subject, subjectExams]) => {
        const subjectConfig = SUBJECT_TASKS[subject];

        return (
          <div key={subject} className="public-cards-subject-group">
            <h3 className="public-cards-subject-title">
              {subjectConfig?.name || subject}
            </h3>
            <div className="public-cards-grid">
              {subjectExams.map((exam) => {
                const score = getScoreDisplay(exam);
                const displayScore = score.secondary || score.primary;
                const maxScore = score.secondary ? 100 : getMaxScore(exam.subject);
                const percentage = (parseFloat(displayScore) / maxScore) * 100;
                const scoreColor = getScoreColor(parseFloat(displayScore), maxScore);

        return (
          <div
            key={exam.id}
            className="public-exam-card"
            onClick={() => onExamClick(exam)}
          >
            {/* Акцентная полоска сверху */}
            <div
              className="public-card-accent"
              style={{ backgroundColor: scoreColor }}
            />

            {/* Шапка карточки */}
            <div className="public-card-header">
              <div className="public-card-subject">
                {exam.name || 'Экзамен'}
              </div>
              <div className="public-card-icon">
                {getSubjectIcon(exam.subject)}
              </div>
            </div>

            {/* Тело карточки - круговой график */}
            <div className="public-card-body">
              <div className="public-circular-progress">
                <svg viewBox="0 0 120 120" className="public-progress-ring">
                  {/* Фоновое кольцо */}
                  <circle
                    cx="60"
                    cy="60"
                    r="50"
                    fill="none"
                    stroke="#F3F4F6"
                    strokeWidth="10"
                  />
                  {/* Прогресс */}
                  <circle
                    cx="60"
                    cy="60"
                    r="50"
                    fill="none"
                    stroke={scoreColor}
                    strokeWidth="10"
                    strokeLinecap="round"
                    strokeDasharray={`${2 * Math.PI * 50}`}
                    strokeDashoffset={`${2 * Math.PI * 50 * (1 - percentage / 100)}`}
                    transform="rotate(-90 60 60)"
                    className="public-progress-circle"
                  />
                </svg>

                {/* Цифра в центре */}
                <div className="public-progress-score">
                  <span className="public-score-number">{displayScore}</span>
                  {score.secondary && displayScore === score.secondary && (
                    <span className="public-score-primary">/{score.primary}</span>
                  )}
                </div>
              </div>
            </div>

            {/* Подвал карточки */}
            <div className="public-card-footer">
              <div className="public-card-max-score">Макс: {maxScore}</div>
            </div>
          </div>
        );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default PublicResultsCards;
