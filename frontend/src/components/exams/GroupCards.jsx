import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useGroups } from '../../hooks/useGroups';
import { useExams } from '../../hooks/useExams';
import { useApi } from '../../hooks/useApi';
import GroupExamsListModal from './GroupExamsListModal';
import GroupExamsModal from './GroupExamsModal';
import ExamForm from './ExamForm';
import { formatSchedule, getDeclension } from '../../utils/helpers';
import { getSubjectDisplayName } from '../../services/constants';

const GroupCards = ({ showNotification }) => {
  const { groups, loadGroups } = useGroups();
  const { exams, loadExams } = useExams();
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [selectedExamTypeId, setSelectedExamTypeId] = useState(null);
  const [showExamForm, setShowExamForm] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [shouldRefreshExams, setShouldRefreshExams] = useState(false);
  const [allExamTypes, setAllExamTypes] = useState([]);
  const { makeRequest } = useApi();

  // Загрузка данных
  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        await Promise.all([
          loadGroups(),
          loadExams(),
          // Загружаем все типы экзаменов для фильтрации
          makeRequest('GET', '/exam-types/').then(data => setAllExamTypes(data || []))
        ]);
      } catch (err) {
        showNotification('Ошибка загрузки данных', 'error');
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Загружаем только при монтировании компонента

  // Перезагрузка экзаменов при необходимости
  useEffect(() => {
    if (shouldRefreshExams) {
      console.log('Перезагружаем экзамены из базы данных...');
      loadExams().then(() => {
        console.log('Экзамены успешно перезагружены');
      }).catch(err => {
        console.error('Ошибка перезагрузки экзаменов:', err);
      });
      setShouldRefreshExams(false);
    }
  }, [shouldRefreshExams, loadExams]);

  // Обработчики для двухуровневой навигации
  const handleGroupClick = useCallback((group) => {
    setSelectedGroup(group);
    setSelectedExamTypeId(null); // Сбрасываем выбранный экзамен
  }, []);

  const handleSelectExam = useCallback((examTypeId) => {
    setSelectedExamTypeId(examTypeId);
  }, []);

  const handleBackToList = useCallback(() => {
    setSelectedExamTypeId(null);
  }, []);

  const handleCloseModal = useCallback((needsRefresh = false) => {
    setSelectedGroup(null);
    setSelectedExamTypeId(null);
    if (needsRefresh) {
      setShouldRefreshExams(true);
    }
  }, []);

  const handleCloseExamForm = useCallback((needsRefresh = false) => {
    setShowExamForm(false);
    if (needsRefresh) {
      setShouldRefreshExams(true);
    }
  }, []);

  const handleExamsDataChanged = useCallback(() => {
    console.log('handleExamsDataChanged вызван, устанавливаем shouldRefreshExams в true');
    setShouldRefreshExams(true); // Установить флаг для обновления данных
  }, []);

  // Мемоизируем массивы
  const groupsArray = useMemo(() => Array.isArray(groups) ? groups : [], [groups]);
  const examsArray = useMemo(() => Array.isArray(exams) ? exams : [], [exams]);

  // Стабильная функция уведомлений
  const stableShowNotification = useCallback((message, type) => {
    showNotification(message, type);
  }, [showNotification]);

  if (isLoading) {
    return (
      <div className="groups-container">
        <div className="loading">Загрузка данных...</div>
      </div>
    );
  }

  if (groupsArray.length === 0) {
    return (
      <div className="groups-container">
        <div className="section-header">
          <h2>Группы и экзамены</h2>
          <button 
            onClick={() => setShowExamForm(true)}
            className="btn btn-success"
          >
            ➕ Добавить экзамен
          </button>
        </div>
        
        <div className="empty-state">
          <div className="empty-icon">📚</div>
          <h3>Нет групп</h3>
          <p>Создайте группы на вкладке "Группы"</p>
        </div>

        {showExamForm && (
          <ExamForm
            onClose={handleCloseExamForm}
            showNotification={stableShowNotification}
          />
        )}
      </div>
    );
  }

  return (
    <div className="groups-container">
      <div className="section-header">
        <h2>Группы и экзамены</h2>
        <button 
          onClick={() => setShowExamForm(true)}
          className="btn btn-success"
        >
          ➕ Добавить экзамен
        </button>
      </div>

      <div className="groups-grid">
        {groupsArray.map(group => {
          const studentsCount = group.students?.length || 0;
          const groupStudentIds = group.students?.map(s => s.id) || [];
          
          // Получаем exam_type_id, которые принадлежат этой группе
          const groupExamTypeIds = new Set(
            allExamTypes
              .filter(et => et.group_id === group.id)
              .map(et => et.id)
          );
          
          // Фильтруем экзамены: только для студентов группы И только те, у которых exam_type принадлежит этой группе
          const groupExams = examsArray.filter(exam => {
            // Проверяем, что студент в группе
            if (!groupStudentIds.includes(exam.id_student)) {
              return false;
            }
            // Проверяем, что exam_type принадлежит этой группе
            if (exam.exam_type_id && !groupExamTypeIds.has(exam.exam_type_id)) {
              return false;
            }
            return true;
          });
          
          // Подсчитываем уникальные типы экзаменов (только те, что принадлежат этой группе)
          const examTypeIds = [...new Set(
            groupExams
              .map(exam => exam.exam_type_id)
              .filter(id => id && groupExamTypeIds.has(id))
          )];
          
          let mainSubject = group.subject || 'Не указан';
          if (!group.subject) {
            const subjectCounts = {};
            groupExams.forEach(exam => {
              subjectCounts[exam.subject] = (subjectCounts[exam.subject] || 0) + 1;
            });
            mainSubject = Object.keys(subjectCounts).sort((a, b) => 
              subjectCounts[b] - subjectCounts[a]
            )[0] || 'Не указан';
          }
          
          const mainSubjectExamsCount = groupExams.filter(e => e.subject === mainSubject).length;
          const displayName = group.name || `${group.exam_type || ''} ${getSubjectDisplayName(mainSubject)} - ${group.teacher_name || group.teacher || ''}`.trim();
          
          let groupInfo = [];
          if (group.school) groupInfo.push(`🏫 ${group.school}`);
          if (group.exam_type) groupInfo.push(`📝 ${group.exam_type}`);
          const groupInfoStr = groupInfo.length > 0 ? groupInfo.join(' • ') : '';

          return (
            <div
              key={group.id}
              className="group-card"
              onClick={() => handleGroupClick(group)}
            >
              <div className="group-card-header">
                <h3>{displayName}</h3>
                <span className="students-count">
                  {studentsCount} {getDeclension(studentsCount, 'ученик', 'ученика', 'учеников')}
                </span>
              </div>
              
              {groupInfoStr && (
                <div className="group-info">{groupInfoStr}</div>
              )}
              
              <div className="group-details">
                <span>👨‍🏫 {group.teacher_name || group.teacher || 'Не указан'}</span>
                <span>📖 {getSubjectDisplayName(mainSubject)}</span>
                {group.schedule && (
                  <span className="schedule">
                    📅 {formatSchedule(group.schedule)}
                  </span>
                )}
              </div>
              
              <div className="group-footer">
                <span>📊 Экзаменов: <strong>{examTypeIds.length}</strong> ({mainSubjectExamsCount} работ)</span>
                <span className="open-arrow">Открыть →</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Модальное окно со списком экзаменов */}
      {selectedGroup && !selectedExamTypeId && (
        <GroupExamsListModal
          group={selectedGroup}
          allExams={examsArray}
          onClose={handleCloseModal}
          onSelectExam={handleSelectExam}
          showNotification={stableShowNotification}
          onDataChanged={handleExamsDataChanged}
        />
      )}

      {/* Модальное окно с деталями конкретного экзамена */}
      {selectedGroup && selectedExamTypeId && (
        <GroupExamsModal
          group={selectedGroup}
          allExams={examsArray}
          examTypeId={selectedExamTypeId}
          onClose={handleCloseModal}
          onBack={handleBackToList}
          onDataChanged={handleExamsDataChanged}
          // showNotification={stableShowNotification}
        />
      )}

      {/* Форма добавления экзамена */}
      {showExamForm && (
        <ExamForm
          onClose={handleCloseExamForm}
          showNotification={stableShowNotification}
        />
      )}
    </div>
  );
};

export default GroupCards;