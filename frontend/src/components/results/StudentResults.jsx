import React, { useState, useMemo } from 'react';
import { getSubjectDisplayName } from '../../utils/helpers';
import { calculateTotalScore } from '../../utils/calculations';
import { SUBJECT_TASKS } from '../../services/constants';

const StudentResults = ({ student, exams, groups }) => {
  const [expanded, setExpanded] = useState(false);

  // Группировка экзаменов по предметам
  const examsBySubject = exams.reduce((acc, exam) => {
    if (!acc[exam.subject]) {
      acc[exam.subject] = [];
    }
    acc[exam.subject].push(exam);
    return acc;
  }, {});

  // Получаем группы студента
  const studentGroups = groups.filter(group => 
    group.students?.some(s => s.id === student.id)
  );

  const calculatePrimaryScore = (answer, subject) => {
    if (!answer) return 0;
    const answers = answer.split(',').map(s => s.trim());
    const subjectConfig = SUBJECT_TASKS[subject];
    const maxPerTask = subjectConfig?.maxPerTask;
    
    return answers.reduce((sum, ans, index) => {
      if (ans === '-') return sum;
      const score = parseInt(ans) || 0;
      // Если есть maxPerTask, ограничиваем балл максимумом
      if (maxPerTask && maxPerTask[index] !== undefined) {
        return sum + Math.min(score, maxPerTask[index]);
      }
      return sum + score;
    }, 0);
  };

  return (
    <div className="student-results-card">
      <div 
        className="student-results-header"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="student-info">
          <h3>{student.fio}</h3>
          {student.phone && (
            <span className="phone">📱 {student.phone}</span>
          )}
          {studentGroups.length > 0 && (
            <div className="student-groups">
              {studentGroups.map(group => (
                <span key={group.id} className="group-tag">
                  🏫 {group.name}
                </span>
              ))}
            </div>
          )}
        </div>
        
        <div className="results-summary">
          <span className="exams-count">
            📊 Экзаменов: <strong>{exams.length}</strong>
          </span>
          <span className="expand-icon">
            {expanded ? '▼' : '▶'}
          </span>
        </div>
      </div>

      {expanded && Object.keys(examsBySubject).length > 0 && (
        <div className="student-results-details">
          {Object.entries(examsBySubject).map(([subject, subjectExams]) => (
            <div key={subject} className="subject-results">
              <h4>
                📖 {getSubjectDisplayName(subject)}
                <span className="subject-exams-count">
                  ({subjectExams.length})
                </span>
              </h4>
              
              {subjectExams.map(exam => {
                const primaryScore = calculatePrimaryScore(exam.answer, subject);
                const finalScore = calculateTotalScore(subject, exam.answer?.split(',') || []);
                const subjectConfig = SUBJECT_TASKS[subject];
                const maxScore = useMemo(() => {
                  if (!subjectConfig?.maxPerTask || subjectConfig.maxPerTask.length === 0) {
                    return subjectConfig?.tasks || 0;
                  }
                  return subjectConfig.maxPerTask.reduce((sum, max) => sum + max, 0);
                }, [subjectConfig]);
                
                return (
                  <div key={exam.id} className="exam-result">
                    <div className="exam-header">
                      <strong>{exam.name}</strong>
                      <div className="exam-scores">
                        <span className="primary-score">
                          Первичный: {primaryScore}
                          {maxScore > 0 && (
                            <span className="score-max">/{maxScore}</span>
                          )}
                        </span>
                        {primaryScore !== finalScore && (
                          <span className="final-score">
                            Итоговый: {finalScore}
                          </span>
                        )}
                      </div>
                    </div>
                    
                    {exam.answer && (
                      <div className="exam-tasks">
                        <div className="tasks-label">Ответы:</div>
                        <div className="tasks-values">
                          {exam.answer.split(',').map((ans, idx) => (
                            <span 
                              key={idx} 
                              className={`task-value ${ans === '-' ? 'na' : ans === '0' ? 'zero' : 'filled'}`}
                            >
                              {ans || '-'}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                    
                    {exam.comment && (
                      <div className="exam-comment">
                        <strong>💬 Комментарий:</strong>
                        <p>{exam.comment}</p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      )}

      {expanded && exams.length === 0 && (
        <div className="no-exams-message">
          <p>У студента нет экзаменов</p>
        </div>
      )}
    </div>
  );
};

export default StudentResults;