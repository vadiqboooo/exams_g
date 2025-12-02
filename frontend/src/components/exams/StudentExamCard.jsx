import React, { useState } from 'react';
import { useExams } from '../../hooks/useExams';
import { SUBJECT_TASKS, getSubjectDisplayName } from '../../services/constants';
import { calculateTotalScore } from '../../utils/calculations';

const StudentExamCard = ({ student, subject, groupId, showNotification }) => {
  const { exams, updateExam, deleteExam, createExam } = useExams();
  const [editingComment, setEditingComment] = useState(false);
  const [comment, setComment] = useState('');

  const studentExam = exams.find(e => 
    e.id_student === student.id && e.subject === subject
  );

  const subjectConfig = SUBJECT_TASKS[subject];
  const tasksCount = subjectConfig?.tasks || 0;

  const handleAddExam = async () => {
    try {
      const examData = {
        name: `Экзамен ${new Date().toLocaleDateString('ru-RU')}`,
        id_student: student.id,
        subject: subject,
        answer: tasksCount > 0 ? '-,'.repeat(tasksCount - 1) + '-' : null,
        comment: null
      };
      
      await createExam(examData);
      showNotification(`Экзамен создан для ${student.fio.split(' ')[0]}`, 'success');
    } catch (err) {
      showNotification('Ошибка создания экзамена', 'error');
    }
  };

  const handleTaskUpdate = async (taskIndex, value) => {
    if (!studentExam) return;

    const answers = studentExam.answer ? studentExam.answer.split(',') : [];
    answers[taskIndex] = value;
    
    try {
      await updateExam(studentExam.id, {
        answer: answers.join(',')
      });
    } catch (err) {
      showNotification('Ошибка обновления результата', 'error');
    }
  };

  const handleCommentSave = async () => {
    if (!studentExam) return;
    
    try {
      await updateExam(studentExam.id, { comment });
      setEditingComment(false);
      showNotification('Комментарий сохранён', 'success');
    } catch (err) {
      showNotification('Ошибка сохранения комментария', 'error');
    }
  };

  const handleDeleteExam = async () => {
    if (!studentExam || !confirm('Удалить этот экзамен?')) return;
    
    try {
      await deleteExam(studentExam.id);
      showNotification('Экзамен удалён', 'success');
    } catch (err) {
      showNotification('Ошибка удаления экзамена', 'error');
    }
  };

  const calculatePrimaryScore = () => {
    if (!studentExam?.answer) return 0;
    const answers = studentExam.answer.split(',').map(s => s.trim());
    return answers.reduce((sum, ans) => sum + (ans !== '-' ? (parseInt(ans) || 0) : 0), 0);
  };

  const primaryScore = calculatePrimaryScore();
  const finalScore = calculateTotalScore(subject, studentExam?.answer?.split(',') || []);

  if (!studentExam) {
    return (
      <div className="student-exam-card no-exam">
        <div className="card-header">
          <strong>{student.fio}</strong>
          <button onClick={handleAddExam} className="btn btn-success">
            ➕ Добавить экзамен
          </button>
        </div>
        <div className="no-exam-content">
          <div className="no-exam-icon">📝</div>
          <p>У студента нет экзамена по этому предмету</p>
        </div>
      </div>
    );
  }

  return (
    <div className="student-exam-card">
      <div className="card-header">
        <strong>{student.fio}</strong>
        <div className="card-actions">
          <span className="total-score">
            Σ: {primaryScore}
            {finalScore !== primaryScore && (
              <span className="final-score"> ({finalScore})</span>
            )}
          </span>
          <button 
            onClick={handleDeleteExam}
            className="btn btn-danger"
            title="Удалить экзамен"
          >
            🗑️ Удалить
          </button>
        </div>
      </div>

      <div className="card-content">
        {tasksCount > 0 && studentExam.answer && (
          <div className="tasks-grid">
            {Array.from({ length: tasksCount }, (_, i) => {
              const answers = studentExam.answer.split(',').map(s => s.trim());
              const answer = answers[i] || '-';
              const maxScore = subjectConfig?.maxPerTask?.[i] || 1;
              const score = answer !== '-' ? (parseInt(answer) || 0) : 0;
              
              const bgColor = answer === '-' ? '#f8f9fa' : 
                            score === 0 ? '#ffebee' : 
                            score >= maxScore ? '#e8f5e9' : 
                            '#fff3e0';

              return (
                <div key={i} className="task-item">
                  <div className="task-number">{i + 1}</div>
                  <input
                    type="text"
                    maxLength="2"
                    value={answer}
                    onChange={(e) => handleTaskUpdate(i, e.target.value)}
                    style={{ backgroundColor: bgColor }}
                    className="task-input"
                  />
                  <div className="task-max">max: {maxScore}</div>
                </div>
              );
            })}
          </div>
        )}

        <div className="comment-section">
          <div className="comment-header">
            <span>💬 Комментарий:</span>
            {!editingComment && (
              <button 
                onClick={() => {
                  setComment(studentExam.comment || '');
                  setEditingComment(true);
                }}
                className="btn btn-secondary"
              >
                Редактировать
              </button>
            )}
          </div>
          
          {editingComment ? (
            <div className="comment-edit">
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Добавить комментарий к экзамену..."
                rows="3"
              />
              <div className="comment-actions">
                <button onClick={handleCommentSave} className="btn btn-success">
                  Сохранить
                </button>
                <button 
                  onClick={() => setEditingComment(false)}
                  className="btn btn-secondary"
                >
                  Отмена
                </button>
              </div>
            </div>
          ) : (
            <div className="comment-display">
              {studentExam.comment || 'Нет комментария'}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default StudentExamCard;