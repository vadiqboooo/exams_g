import React, { useState, useMemo, useCallback } from 'react';
import Modal from '../common/Modal';
import { getSubjectDisplayName } from '../../utils/helpers';
import './GroupExamsModal.css';
import './GroupExamsListModal.css'; // Добавьте эту строку

const GroupExamsListModal = ({ 
  group, 
  allExams, 
  onClose, 
  onSelectExam,
  showNotification 
}) => {
  const [showAddForm, setShowAddForm] = useState(false);
  const [newExamName, setNewExamName] = useState('');

  // Группируем экзамены по названию
  const examsByTitle = useMemo(() => {
    if (!group || !allExams) return {};
    
    const groupStudentIds = group.students?.map(s => s.id) || [];
    const groupExams = allExams.filter(exam => 
      groupStudentIds.includes(exam.id_student)
    );
    
    const grouped = {};
    groupExams.forEach(exam => {
      const title = exam.name || 'Без названия';
      if (!grouped[title]) {
        grouped[title] = {
          exams: [],
          subjects: new Set(),
          studentCount: 0
        };
      }
      grouped[title].exams.push(exam);
      grouped[title].subjects.add(exam.subject);
      
      // Считаем уникальных студентов в этом экзамене
      const studentIds = grouped[title].exams.map(e => e.id_student);
      grouped[title].studentCount = new Set(studentIds).size;
    });
    
    return grouped;
  }, [group, allExams]);

  // Основной предмет группы
  const mainSubject = useMemo(() => {
    if (!group) return null;
    if (group.subject) return group.subject;
    
    // Находим самый частый предмет среди экзаменов группы
    const groupStudentIds = group.students?.map(s => s.id) || [];
    const groupExams = allExams.filter(exam => 
      groupStudentIds.includes(exam.id_student)
    );
    
    const subjectCounts = {};
    groupExams.forEach(exam => {
      subjectCounts[exam.subject] = (subjectCounts[exam.subject] || 0) + 1;
    });
    
    return Object.keys(subjectCounts).sort((a, b) => 
      subjectCounts[b] - subjectCounts[a]
    )[0] || null;
  }, [group, allExams]);

  const handleAddExamType = useCallback((e) => {
    e.preventDefault();
    if (!newExamName.trim()) return;
    
    // Здесь логика добавления нового типа экзамена
    // showNotification(`Тип экзамена "${newExamName}" добавлен`, 'success');
    setNewExamName('');
    setShowAddForm(false);
  }, [newExamName, showNotification]);

  const examTitles = Object.keys(examsByTitle);

  if (!group) return null;

  return (
    <Modal onClose={onClose} className="group-exams-modal-container">
      <div className="group-exams-modal">
        <div className="group-modal-header">
          <div>
            <h2>{group.name || `Группа ${group.teacher_name || group.teacher || ''}`}</h2>
            <p className="teacher-info">👨‍🏫 {group.teacher_name || group.teacher || 'Не указан'}</p>
            {mainSubject && (
              <p className="subject-info">📖 {getSubjectDisplayName(mainSubject)}</p>
            )}
          </div>
          <button onClick={onClose} className="close-btn">×</button>
        </div>

        <div className="exams-list-header">
          <h3>📋 Список экзаменов</h3>
          <button 
            onClick={() => setShowAddForm(!showAddForm)}
            className="btn btn-outline btn-sm"
          >
            {showAddForm ? 'Отмена' : '➕ Добавить тип экзамена'}
          </button>
        </div>

        {showAddForm && (
          <form onSubmit={handleAddExamType} className="add-exam-type-form">
            <input
              type="text"
              value={newExamName}
              onChange={(e) => setNewExamName(e.target.value)}
              placeholder="Введите название экзамена"
              className="exam-name-input"
              autoFocus
            />
            <button type="submit" className="btn btn-success btn-sm">
              Добавить
            </button>
          </form>
        )}

        <div className="exams-list-container">
          {examTitles.length === 0 ? (
            <div className="empty-exams-list">
              <div className="empty-icon">📝</div>
              <h3>Нет экзаменов</h3>
              <p>Добавьте первый экзамен для этой группы</p>
            </div>
          ) : (
            <div className="exams-grid">
              {examTitles.map(title => {
                const examData = examsByTitle[title];
                const subjects = Array.from(examData.subjects);
                
                return (
                  <div
                    key={title}
                    className="exam-title-card"
                    onClick={() => onSelectExam(title)}
                  >
                    <div className="exam-title-header">
                      <h4>{title}</h4>
                      <span className="exam-count">
                        {examData.exams.length} {getDeclension(examData.exams.length, 'работа', 'работы', 'работ')}
                      </span>
                    </div>
                    
                    <div className="exam-title-details">
                      <span>👥 {examData.studentCount} {getDeclension(examData.studentCount, 'студент', 'студента', 'студентов')}</span>
                      {subjects.length > 0 && (
                        <span>📚 {subjects.map(s => getSubjectDisplayName(s)).join(', ')}</span>
                      )}
                    </div>
                    
                    <div className="exam-title-footer">
                      <span className="open-details">Посмотреть результаты →</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
};

// Вспомогательная функция для склонения
const getDeclension = (number, one, two, five) => {
  let n = Math.abs(number);
  n %= 100;
  if (n >= 5 && n <= 20) {
    return five;
  }
  n %= 10;
  if (n === 1) {
    return one;
  }
  if (n >= 2 && n <= 4) {
    return two;
  }
  return five;
};

export default GroupExamsListModal;