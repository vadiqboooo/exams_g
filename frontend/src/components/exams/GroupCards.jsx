import React, { useState, useEffect } from 'react';
import { useGroups } from '../../hooks/useGroups';
import { useExams } from '../../hooks/useExams';
import GroupExamsModal from './GroupExamsModal';
import ExamForm from './ExamForm';
import { getSubjectDisplayName, formatSchedule, getDeclension } from '../../utils/helpers';

const GroupCards = ({ showNotification }) => {
  const { groups, loadGroups } = useGroups();
  const { exams, loadExams } = useExams();
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [showExamForm, setShowExamForm] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        await Promise.all([
          loadGroups(),
          loadExams()
        ]);
      } catch (err) {
        showNotification('Ошибка загрузки данных', 'error');
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchData();
  }, [loadGroups, loadExams, showNotification]);

  const handleGroupClick = (group) => {
    setSelectedGroup(group);
  };

  const handleCloseModal = () => {
    setSelectedGroup(null);
  };

  // Убедимся, что groups - это массив
  const groupsArray = Array.isArray(groups) ? groups : [];
  const examsArray = Array.isArray(exams) ? exams : [];

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
            onClose={() => setShowExamForm(false)}
            showNotification={showNotification}
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
          
          const groupExams = examsArray.filter(exam => groupStudentIds.includes(exam.id_student));
          
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
          const displayName = group.name || `${group.exam_type || ''} ${getSubjectDisplayName(mainSubject)} - ${group.teacher}`.trim();
          
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
                <span>👨‍🏫 {group.teacher}</span>
                <span>📖 {getSubjectDisplayName(mainSubject)}</span>
                {group.schedule && (
                  <span className="schedule">
                    📅 {formatSchedule(group.schedule)}
                  </span>
                )}
              </div>
              
              <div className="group-footer">
                <span>📊 Экзаменов: <strong>{mainSubjectExamsCount}</strong></span>
                <span className="open-arrow">Открыть →</span>
              </div>
            </div>
          );
        })}
      </div>

      {selectedGroup && (
        <GroupExamsModal 
          group={selectedGroup}
          allExams={examsArray} // Передаем загруженные экзамены
          onClose={handleCloseModal}
          showNotification={showNotification}
        />
      )}

      {showExamForm && (
        <ExamForm
          onClose={() => setShowExamForm(false)}
          showNotification={showNotification}
        />
      )}
    </div>
  );
};

export default GroupCards;