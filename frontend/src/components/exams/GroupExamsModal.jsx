import React, { useState, useEffect } from 'react';
import Modal from '../common/Modal';
import { getSubjectDisplayName } from '../../utils/helpers';
import { SUBJECT_TASKS } from '../../services/constants';
import './GroupExamsModal.css';

const GroupExamsModal = ({ group, allExams, onClose, showNotification }) => {
  const [groupExams, setGroupExams] = useState([]);
  const [mainSubject, setMainSubject] = useState(null);
  const [mainSubjectConfig, setMainSubjectConfig] = useState(null);

  useEffect(() => {
    if (group && allExams) {
      // Получаем ID студентов группы
      const groupStudentIds = group.students?.map(s => s.id) || [];
      
      // Фильтруем экзамены студентов группы
      const filteredExams = allExams.filter(exam => 
        groupStudentIds.includes(exam.id_student)
      );
      
      setGroupExams(filteredExams);
      
      // Определяем основной предмет (используем subject из группы)
      let mainSubj = group.subject;
      if (!mainSubj && filteredExams.length > 0) {
        // Если в группе нет subject, берем самый частый из экзаменов
        const subjectCounts = {};
        filteredExams.forEach(exam => {
          subjectCounts[exam.subject] = (subjectCounts[exam.subject] || 0) + 1;
        });
        mainSubj = Object.keys(subjectCounts).sort((a, b) => 
          subjectCounts[b] - subjectCounts[a]
        )[0] || null;
      }
      
      setMainSubject(mainSubj);
      
      // Получаем конфигурацию для основного предмета
      if (mainSubj) {
        setMainSubjectConfig(SUBJECT_TASKS[mainSubj]);
      }
    }
  }, [group, allExams]);

  // Получаем экзамен студента по основному предмету
  const getStudentExam = (studentId) => {
    return groupExams.find(exam => 
      exam.id_student === studentId && exam.subject === mainSubject
    );
  };

  // Обработчик изменения ответа на задание
  const handleTaskChange = async (examId, taskIndex, value) => {
    try {
      // Валидация ввода
      let validatedValue = value.replace(/[^0-9\-]/g, '');
      if (validatedValue === '--') validatedValue = '-';
      
      const maxScore = mainSubjectConfig?.maxPerTask?.[taskIndex] || 1;
      if (validatedValue && validatedValue !== '-' && parseInt(validatedValue) > maxScore) {
        validatedValue = maxScore.toString();
      }

      // Получаем текущие ответы
      const exam = groupExams.find(e => e.id === examId);
      if (!exam) return;

      const answers = exam.answer ? exam.answer.split(',').map(s => s.trim()) : [];
      
      // Обновляем нужный ответ
      while (answers.length <= taskIndex) {
        answers.push('-');
      }
      answers[taskIndex] = validatedValue;

      // Обновляем на сервере
      // await axios.put(`${API_BASE}/exams/${examId}`, {
      //   answer: answers.join(',')
      // });

      // Обновляем локальное состояние
      setGroupExams(prev => prev.map(e => 
        e.id === examId ? { ...e, answer: answers.join(',') } : e
      ));

      showNotification('Результат сохранён ✓', 'success');
    } catch (err) {
      showNotification('Ошибка сохранения ✗', 'error');
    }
  };

  // Обработчик изменения комментария
  const handleCommentChange = async (examId, comment) => {
    try {
      // await axios.put(`${API_BASE}/exams/${examId}`, {
      //   comment: comment.trim() || null
      // });

      setGroupExams(prev => prev.map(e => 
        e.id === examId ? { ...e, comment } : e
      ));

      showNotification('Комментарий сохранён ✓', 'success');
    } catch (err) {
      showNotification('Ошибка сохранения комментария ✗', 'error');
    }
  };

  // Добавление экзамена для студента
  const handleAddExam = async (studentId) => {
    try {
      const student = group.students.find(s => s.id === studentId);
      if (!student) return;

      const examData = {
        name: `Экзамен ${new Date().toLocaleDateString('ru-RU')}`,
        id_student: studentId,
        subject: mainSubject,
        answer: mainSubjectConfig?.tasks ? 
          Array(mainSubjectConfig.tasks).fill('-').join(',') : null,
        comment: null
      };

      // const response = await axios.post(`${API_BASE}/exams/`, examData);
      // const newExam = response.data;

      // Временная заглушка - создаем локальный экзамен
      const newExam = {
        ...examData,
        id: Date.now() // временный ID
      };

      setGroupExams(prev => [...prev, newExam]);
      showNotification(`Экзамен добавлен для ${student.fio.split(' ')[0]} ✓`, 'success');
    } catch (err) {
      showNotification('Ошибка добавления экзамена ✗', 'error');
    }
  };

  // Удаление экзамена
  const handleDeleteExam = async (examId) => {
    if (!window.confirm('Удалить этот экзамен?')) return;

    try {
      // await axios.delete(`${API_BASE}/exams/${examId}`);
      setGroupExams(prev => prev.filter(e => e.id !== examId));
      showNotification('Экзамен удалён', 'success');
    } catch (err) {
      showNotification('Ошибка удаления', 'error');
    }
  };

  // Расчет первичного балла
  const calculatePrimaryScore = (answer) => {
    if (!answer) return 0;
    const answers = answer.split(',').map(s => s.trim());
    return answers.reduce((sum, ans) => 
      sum + (ans !== '-' ? (parseInt(ans) || 0) : 0), 0
    );
  };

  if (!group) return null;

  return (
    <Modal onClose={onClose} size="xl" className="group-exams-modal-container">
      <div className="group-exams-modal">
        <div className="group-modal-header">
          <div>
            <h2>{group.name}</h2>
            <p className="teacher-info">👨‍🏫 {group.teacher}</p>
          </div>
          <button onClick={onClose} className="close-btn">×</button>
        </div>

        <div className="group-modal-content">
          {!mainSubject ? (
            <div className="group-no-exams-state">
              <div className="group-no-exams-icon">📝</div>
              <h3>Нет основного предмета</h3>
              <p>Добавьте предмет для этой группы в настройках</p>
            </div>
          ) : (
            <>
              {/* Заголовок предмета */}
              <div className="subject-main-header">
                <h3>
                  📖 {getSubjectDisplayName(mainSubject)}
                  {mainSubjectConfig?.tasks && (
                    <span className="tasks-count">
                      ({mainSubjectConfig.tasks} заданий)
                    </span>
                  )}
                </h3>
              </div>

              {/* Карточки студентов */}
              <div className="students-exams-container">
                {group.students.map(student => {
                  const exam = getStudentExam(student.id);
                  const hasExam = !!exam;
                  const tasksCount = mainSubjectConfig?.tasks || 0;
                  const primaryScore = hasExam && exam.answer ? 
                    calculatePrimaryScore(exam.answer) : 0;

                  return (
                    <div key={student.id} className="student-exam-card">
                      {/* Заголовок карточки студента */}
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
                                Первичный балл: <strong>{primaryScore}</strong>
                              </span>
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

                      {/* Содержимое карточки */}
                      <div className="student-exam-content">
                        {hasExam ? (
                          <>
                            {/* Таблица заданий */}
                            {tasksCount > 0 && (
                              <div className="exam-tasks-section">
                                <div className="tasks-label">Ответы по заданиям:</div>
                                <div className="tasks-grid">
                                  {Array.from({ length: tasksCount }).map((_, index) => {
                                    const answers = exam.answer ? 
                                      exam.answer.split(',').map(s => s.trim()) : [];
                                    const answer = answers[index] || '-';
                                    const maxScore = mainSubjectConfig?.maxPerTask?.[index] || 1;
                                    
                                    return (
                                      <div key={index} className="task-item">
                                        <div className="task-number">{index + 1}</div>
                                        <input
                                          type="text"
                                          maxLength="2"
                                          value={answer}
                                          onChange={(e) => handleTaskChange(exam.id, index, e.target.value)}
                                          className="task-input"
                                        />
                                        <div className="task-max">max: {maxScore}</div>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            )}

                            {/* Комментарий */}
                            <div className="exam-comment-section">
                              <div className="comment-label">💬 Комментарий:</div>
                              <textarea
                                value={exam.comment || ''}
                                onChange={(e) => handleCommentChange(exam.id, e.target.value)}
                                className="comment-textarea"
                                placeholder="Добавить комментарий к экзамену..."
                                rows="3"
                              />
                            </div>
                          </>
                        ) : (
                          <div className="no-exam-content">
                            <div className="no-exam-icon">📝</div>
                            <p>У студента нет экзамена по этому предмету</p>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </div>
    </Modal>
  );
};

export default GroupExamsModal;