import React, { useState, useEffect } from 'react';
import { calculateTotalScore, calculatePrimaryScore } from '../../utils/calculations';
import { SUBJECT_TASKS, getSubjectDisplayName } from '../../services/constants';
import { useStudents } from '../../hooks/useStudents';

// Функция для нормализации названия предмета: преобразует полное название в ключ или возвращает ключ
const normalizeSubject = (subject) => {
  if (!subject) return null;
  
  // Если это уже ключ из SUBJECT_TASKS, возвращаем его
  if (SUBJECT_TASKS[subject]) {
    return subject;
  }
  
  // Ищем по полному названию
  for (const [key, config] of Object.entries(SUBJECT_TASKS)) {
    if (config.name === subject) {
      return key;
    }
  }
  
  // Если не нашли, возвращаем исходное значение (может быть кастомный предмет)
  return subject;
};

const StudentResults = ({ student, exams, groups, showNotification, onStudentUpdate }) => {
  const [expanded, setExpanded] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState({
    admin_comment: student?.admin_comment || '',
    parent_contact_status: student?.parent_contact_status || ''
  });
  const [isSaving, setIsSaving] = useState(false);
  
  const userRole = localStorage.getItem("role") || "teacher";
  const isAdmin = userRole === "admin";
  const { updateStudent } = useStudents();

  // Обновляем editData при изменении student
  useEffect(() => {
    if (student) {
      setEditData({
        admin_comment: student.admin_comment || '',
        parent_contact_status: student.parent_contact_status || ''
      });
    }
  }, [student]);


  // Получаем группы студента (для учителей это уже только группы учителя)
  const studentGroups = groups.filter(group => 
    group.students?.some(s => s.id === student.id)
  );

  // Для учителей: получаем предметы из групп учителя, в которых состоит студент (нормализованные)
  const allowedSubjects = new Set();
  if (!isAdmin && studentGroups.length > 0) {
    // Все группы уже принадлежат учителю (отфильтрованы в ResultsView)
    studentGroups.forEach(group => {
      if (group.subject) {
        const normalizedSubject = normalizeSubject(group.subject);
        if (normalizedSubject) {
          allowedSubjects.add(normalizedSubject);
          // Также добавляем полное название, если оно отличается
          if (normalizedSubject !== group.subject) {
            allowedSubjects.add(group.subject);
          }
        }
      }
    });
  }

  // Фильтруем экзамены для учителей: только по предметам групп
  let filteredExams = exams;
  if (!isAdmin && allowedSubjects.size > 0) {
    filteredExams = exams.filter(exam => {
      if (!exam.subject) return false;
      // Проверяем как ключ, так и нормализованное значение
      const normalizedExamSubject = normalizeSubject(exam.subject);
      return allowedSubjects.has(exam.subject) || allowedSubjects.has(normalizedExamSubject);
    });
  }

  // Группировка экзаменов по предметам
  const examsBySubject = filteredExams.reduce((acc, exam) => {
    if (!acc[exam.subject]) {
      acc[exam.subject] = [];
    }
    acc[exam.subject].push(exam);
    return acc;
  }, {});

  // Используем calculatePrimaryScore из calculations.js

  // Функция для вычисления максимального балла по предмету
  const calculateMaxScore = (subjectConfig, subject) => {
    if (!subjectConfig?.maxPerTask || subjectConfig.maxPerTask.length === 0) {
      return subjectConfig?.tasks || 0;
    }
    
    // Для infa_9 учитываем, что из пары заданий 13.1/13.2 учитывается только один балл, задание 14 обычное
    if (subject === 'infa_9') {
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
  };

  // Функция для получения текста статуса на русском языке
  const getStatusText = (status) => {
    const statusMap = {
      'informed': 'Информация передана',
      'callback': 'Перезвонить позже',
      'no_answer': 'Нет ответа'
    };
    return statusMap[status] || status || 'Не указан';
  };

  // Функция для получения цвета статуса
  const getStatusColor = (status) => {
    const colorMap = {
      'informed': '#10b981', // зеленый
      'callback': '#f59e0b', // оранжевый
      'no_answer': '#ef4444' // красный
    };
    return colorMap[status] || '#6b7280'; // серый по умолчанию
  };

  // Функция для получения фонового цвета карточки в зависимости от статуса
  const getCardBackgroundColor = (status) => {
    if (!status || !status.trim()) return null;
    
    const colorMap = {
      'informed': '#f0fdf4', // тускло зеленый
      'callback': '#fefce8', // тускло желтый
      'no_answer': '#faf5ff' // тускло фиолетовый
    };
    return colorMap[status] || null;
  };

  // Получаем цвет фона для карточки
  const cardBgColor = getCardBackgroundColor(student?.parent_contact_status);

  // Функция сохранения изменений
  const handleSave = async () => {
    if (!isAdmin || !student) return;
    
    setIsSaving(true);
    try {
      const updateData = {
        admin_comment: editData.admin_comment?.trim() || null,
        parent_contact_status: editData.parent_contact_status?.trim() || null
      };
      
      await updateStudent(student.id, updateData);
      setIsEditing(false);
      if (showNotification) {
        showNotification('Информация администратора обновлена', 'success');
      }
      if (onStudentUpdate) {
        onStudentUpdate();
      }
    } catch (err) {
      if (showNotification) {
        showNotification(err.message || 'Ошибка сохранения', 'error');
      }
    } finally {
      setIsSaving(false);
    }
  };

  // Функция отмены редактирования
  const handleCancel = () => {
    setEditData({
      admin_comment: student?.admin_comment || '',
      parent_contact_status: student?.parent_contact_status || ''
    });
    setIsEditing(false);
  };

  return (
    <div 
      className="student-results-card"
      style={{
        backgroundColor: cardBgColor || 'white',
        borderLeft: cardBgColor ? `4px solid ${getStatusColor(student?.parent_contact_status)}` : undefined
      }}
    >
      <div 
        className="student-results-header"
        onClick={() => setExpanded(!expanded)}
        style={{
          background: cardBgColor ? 'transparent' : undefined
        }}
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
            📊 Экзаменов: <strong>{filteredExams.length}</strong>
          </span>
          <span className="expand-icon">
            {expanded ? '▼' : '▶'}
          </span>
        </div>
      </div>

      {expanded && (
        <div className="student-results-details">
          {/* Информация администратора - показываем всегда для администраторов */}
          {isAdmin && (
            <div className="admin-info-section" style={{
              padding: '16px',
              marginBottom: '20px',
              backgroundColor: '#f9fafb',
              borderRadius: '8px',
              border: '1px solid #e5e7eb'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <h4 style={{ margin: 0, fontSize: '16px', fontWeight: '600' }}>
                  📋 Информация администратора
                </h4>
                {!isEditing && (
                  <button
                    onClick={() => setIsEditing(true)}
                    style={{
                      padding: '4px 12px',
                      fontSize: '12px',
                      backgroundColor: '#3b82f6',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer'
                    }}
                  >
                    ✏️ Редактировать
                  </button>
                )}
              </div>
              
              {isEditing ? (
                <>
                  <div style={{ marginBottom: '12px' }}>
                    <label style={{ display: 'block', marginBottom: '4px', fontSize: '14px', fontWeight: '500' }}>
                      Статус контакта:
                    </label>
                    <select
                      value={editData.parent_contact_status}
                      onChange={(e) => setEditData({ ...editData, parent_contact_status: e.target.value })}
                      style={{
                        width: '100%',
                        padding: '6px 8px',
                        fontSize: '14px',
                        border: '1px solid #ddd',
                        borderRadius: '4px'
                      }}
                    >
                      <option value="">Не указан</option>
                      <option value="informed">Информация передана</option>
                      <option value="callback">Перезвонить позже</option>
                      <option value="no_answer">Нет ответа</option>
                    </select>
                  </div>
                  
                  <div style={{ marginBottom: '12px' }}>
                    <label style={{ display: 'block', marginBottom: '4px', fontSize: '14px', fontWeight: '500' }}>
                      Комментарий администратора:
                    </label>
                    <textarea
                      value={editData.admin_comment}
                      onChange={(e) => setEditData({ ...editData, admin_comment: e.target.value })}
                      placeholder="Введите комментарий администратора..."
                      rows="4"
                      style={{
                        width: '100%',
                        padding: '8px',
                        fontSize: '14px',
                        border: '1px solid #ddd',
                        borderRadius: '4px',
                        fontFamily: 'inherit',
                        resize: 'vertical'
                      }}
                    />
                  </div>
                  
                  <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                    <button
                      onClick={handleCancel}
                      disabled={isSaving}
                      style={{
                        padding: '6px 16px',
                        fontSize: '14px',
                        backgroundColor: '#6b7280',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: isSaving ? 'not-allowed' : 'pointer'
                      }}
                    >
                      Отмена
                    </button>
                    <button
                      onClick={handleSave}
                      disabled={isSaving}
                      style={{
                        padding: '6px 16px',
                        fontSize: '14px',
                        backgroundColor: '#10b981',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: isSaving ? 'not-allowed' : 'pointer'
                      }}
                    >
                      {isSaving ? 'Сохранение...' : 'Сохранить'}
                    </button>
                  </div>
                </>
              ) : (
                <>
                  {(student.parent_contact_status && student.parent_contact_status.trim()) && (
                    <div style={{ marginBottom: '12px' }}>
                      <strong style={{ display: 'block', marginBottom: '4px', fontSize: '14px' }}>
                        Статус контакта:
                      </strong>
                      <span style={{
                        display: 'inline-block',
                        padding: '4px 12px',
                        borderRadius: '6px',
                        backgroundColor: getStatusColor(student.parent_contact_status) + '20',
                        color: getStatusColor(student.parent_contact_status),
                        fontWeight: '500',
                        fontSize: '14px'
                      }}>
                        {getStatusText(student.parent_contact_status)}
                      </span>
                    </div>
                  )}
                  
                  {student.admin_comment && student.admin_comment.trim() && (
                    <div>
                      <strong style={{ display: 'block', marginBottom: '4px', fontSize: '14px' }}>
                        Комментарий администратора:
                      </strong>
                      <p style={{
                        margin: 0,
                        padding: '8px 12px',
                        backgroundColor: '#ffffff',
                        borderRadius: '6px',
                        fontSize: '14px',
                        lineHeight: '1.5',
                        color: '#374151'
                      }}>
                        {student.admin_comment}
                      </p>
                    </div>
                  )}
                  
                  {!(student.admin_comment && student.admin_comment.trim()) && !(student.parent_contact_status && student.parent_contact_status.trim()) && (
                    <p style={{ margin: 0, color: '#6b7280', fontSize: '14px', fontStyle: 'italic' }}>
                      Информация не заполнена
                    </p>
                  )}
                </>
              )}
            </div>
          )}
          
          {/* Информация администратора для не-администраторов (только просмотр) */}
          {!isAdmin && ((student.admin_comment && student.admin_comment.trim()) || (student.parent_contact_status && student.parent_contact_status.trim())) && (
            <div className="admin-info-section" style={{
              padding: '16px',
              marginBottom: '20px',
              backgroundColor: '#f9fafb',
              borderRadius: '8px',
              border: '1px solid #e5e7eb'
            }}>
              <h4 style={{ marginTop: 0, marginBottom: '12px', fontSize: '16px', fontWeight: '600' }}>
                📋 Информация администратора
              </h4>
              
              {(student.parent_contact_status && student.parent_contact_status.trim()) && (
                <div style={{ marginBottom: '12px' }}>
                  <strong style={{ display: 'block', marginBottom: '4px', fontSize: '14px' }}>
                    Статус контакта:
                  </strong>
                  <span style={{
                    display: 'inline-block',
                    padding: '4px 12px',
                    borderRadius: '6px',
                    backgroundColor: getStatusColor(student.parent_contact_status) + '20',
                    color: getStatusColor(student.parent_contact_status),
                    fontWeight: '500',
                    fontSize: '14px'
                  }}>
                    {getStatusText(student.parent_contact_status)}
                  </span>
                </div>
              )}
              
              {student.admin_comment && student.admin_comment.trim() && (
                <div>
                  <strong style={{ display: 'block', marginBottom: '4px', fontSize: '14px' }}>
                    Комментарий администратора:
                  </strong>
                  <p style={{
                    margin: 0,
                    padding: '8px 12px',
                    backgroundColor: '#ffffff',
                    borderRadius: '6px',
                    fontSize: '14px',
                    lineHeight: '1.5',
                    color: '#374151'
                  }}>
                    {student.admin_comment}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Экзамены по предметам */}
          {Object.keys(examsBySubject).length > 0 && Object.entries(examsBySubject).map(([subject, subjectExams]) => (
            <div key={subject} className="subject-results">
              <h4>
                📖 {getSubjectDisplayName(subject)}
                <span className="subject-exams-count">
                  ({subjectExams.length})
                </span>
              </h4>
              
              {subjectExams.map(exam => {
                const answers = exam.answer ? exam.answer.split(',').map(s => s.trim()) : [];
                const subjectConfig = SUBJECT_TASKS[subject];
                const primaryScore = calculatePrimaryScore(answers, subject, subjectConfig?.maxPerTask);
                const finalScore = calculateTotalScore(subject, exam.answer?.split(',') || []);
                const maxScore = calculateMaxScore(subjectConfig, subject);
                
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

      {expanded && filteredExams.length === 0 && Object.keys(examsBySubject).length === 0 && !(student.admin_comment || student.parent_contact_status) && (
        <div className="student-results-details">
          <div className="no-exams-message">
            <p>У студента нет экзаменов</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default StudentResults;