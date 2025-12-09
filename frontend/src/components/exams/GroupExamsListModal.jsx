import React, { useState, useMemo, useCallback, useEffect } from 'react';
import Modal from '../common/Modal';
import { getSubjectDisplayName } from '../../utils/helpers';
import { useApi } from '../../hooks/useApi';
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
  const [examTypes, setExamTypes] = useState([]);
  const [addingType, setAddingType] = useState(false);
  const { makeRequest } = useApi();

  // Загружаем типы экзаменов для конкретной группы
  useEffect(() => {
    if (!group?.id) return;
    
    let isMounted = true;
    const loadExamTypes = async () => {
      try {
        const data = await makeRequest('GET', `/exam-types/?group_id=${group.id}`);
        if (isMounted) setExamTypes(data);
      } catch (err) {
        showNotification?.(err.message || 'Не удалось загрузить типы экзаменов', 'error');
      }
    };
    loadExamTypes();
    return () => {
      isMounted = false;
    };
  }, [makeRequest, showNotification, group]);

  // Группируем экзамены по exam_type_id
  const examsByTypeId = useMemo(() => {
    if (!group || !allExams) return {};
    
    const groupStudentIds = group.students?.map(s => s.id) || [];
    
    // Получаем только те exam_type_id, которые принадлежат этой группе
    const validExamTypeIds = new Set(examTypes.map(t => t.id));
    
    // Фильтруем экзамены: только для студентов группы И только те, у которых exam_type принадлежит этой группе
    const groupExams = allExams.filter(exam => {
      // Проверяем, что студент в группе
      if (!groupStudentIds.includes(exam.id_student)) {
        return false;
      }
      // Проверяем, что exam_type принадлежит этой группе
      if (exam.exam_type_id && !validExamTypeIds.has(exam.exam_type_id)) {
        return false;
      }
      return true;
    });
    
    const grouped = {};

    // Сначала добавляем известные типы экзаменов для этой группы
    examTypes.forEach((t) => {
      grouped[t.id] = {
        examType: t,
        exams: [],
        subjects: new Set(),
        studentCount: 0
      };
    });

    // Затем наполняем фактами экзамены (только те, что прошли фильтрацию)
    groupExams.forEach(exam => {
      const typeId = exam.exam_type_id;
      if (!typeId) return; // Пропускаем экзамены без exam_type_id
      
      if (!grouped[typeId]) {
        // Если тип экзамена не найден в examTypes, пропускаем (не должен быть для этой группы)
        return;
      }
      grouped[typeId].exams.push(exam);
      grouped[typeId].subjects.add(exam.subject);
      
      // Считаем уникальных студентов в этом экзамене
      const studentIds = grouped[typeId].exams.map(e => e.id_student);
      grouped[typeId].studentCount = new Set(studentIds).size;
    });
    
    return grouped;
  }, [group, allExams, examTypes]);

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

  const handleAddExamType = useCallback(async (e) => {
    e.preventDefault();
    if (!newExamName.trim() || !group?.id) return;
    
    setAddingType(true);
    try {
      const payload = { name: newExamName.trim(), group_id: group.id };
      const created = await makeRequest('POST', '/exam-types/', payload);
      setExamTypes((prev) => {
        const exists = prev.some((t) => t.id === created.id || (t.name === created.name && t.group_id === created.group_id));
        return exists ? prev : [...prev, created];
      });
      showNotification?.(`Тип экзамена "${created.name}" добавлен`, 'success');
      setNewExamName('');
      setShowAddForm(false);
      
      // Автоматически выбираем только что созданный тип экзамена
      if (onSelectExam) {
        onSelectExam(created.id);
      }
    } catch (err) {
      showNotification?.(err.message || 'Не удалось добавить тип экзамена', 'error');
    } finally {
      setAddingType(false);
    }
  }, [makeRequest, newExamName, showNotification, group, onSelectExam]);

  const examTypeIds = Object.keys(examsByTypeId).map(id => parseInt(id));

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
            <button type="submit" className="btn btn-success btn-sm" disabled={addingType}>
              {addingType ? 'Сохранение...' : 'Добавить'}
            </button>
          </form>
        )}

        <div className="exams-list-container">
          {examTypeIds.length === 0 ? (
            <div className="empty-exams-list">
              <div className="empty-icon">📝</div>
              <h3>Нет экзаменов</h3>
              <p>Добавьте первый экзамен для этой группы</p>
            </div>
          ) : (
            <div className="exams-grid">
              {examTypeIds.map(typeId => {
                const examData = examsByTypeId[typeId];
                const subjects = Array.from(examData.subjects);
                const examTypeName = examData.examType?.name || 'Без названия';
                
                return (
                  <div
                    key={typeId}
                    className="exam-title-card"
                    onClick={() => onSelectExam(typeId)}
                  >
                    <div className="exam-title-header">
                      <h4>{examTypeName}</h4>
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