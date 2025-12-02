import React, { useState, useEffect } from 'react';
import { useStudents } from '../../hooks/useStudents';
import { useExams } from '../../hooks/useExams';
import { useGroups } from '../../hooks/useGroups';
import StudentResults from './StudentResults';
import Filters from './Filters';

const ResultsView = ({ showNotification }) => {
  const { students, loadStudents } = useStudents();
  const { exams, loadExams } = useExams();
  const { groups, loadGroups } = useGroups();
  const [filteredStudents, setFilteredStudents] = useState([]);
  const [filters, setFilters] = useState({
    search: '',
    groupId: '',
    subject: ''
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      try {
        await Promise.all([
          loadStudents(),
          loadExams(),
          loadGroups()
        ]);
      } catch (err) {
        showNotification('Ошибка загрузки данных', 'error');
      } finally {
        setIsLoading(false);
      }
    };
    
    loadData();
  }, [loadStudents, loadExams, loadGroups, showNotification]);

  useEffect(() => {
    // Убедимся, что все данные - массивы
    const studentsArray = Array.isArray(students) ? students : [];
    const examsArray = Array.isArray(exams) ? exams : [];
    const groupsArray = Array.isArray(groups) ? groups : [];

    let result = [...studentsArray];

    // Фильтр по поиску
    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      result = result.filter(s => 
        s.fio?.toLowerCase().includes(searchLower)
      );
    }

    // Фильтр по группе
    if (filters.groupId) {
      const group = groupsArray.find(g => g.id === parseInt(filters.groupId));
      if (group) {
        const groupStudentIds = group.students?.map(s => s.id) || [];
        result = result.filter(s => groupStudentIds.includes(s.id));
      }
    }

    // Фильтр по предмету
    if (filters.subject) {
      result = result.filter(student => {
        const studentExams = examsArray.filter(e => e.id_student === student.id);
        return studentExams.some(exam => exam.subject === filters.subject);
      });
    }

    setFilteredStudents(result);
  }, [students, exams, groups, filters]);

  const handleFilterChange = (name, value) => {
    setFilters(prev => ({ ...prev, [name]: value }));
  };

  const clearFilters = () => {
    setFilters({
      search: '',
      groupId: '',
      subject: ''
    });
  };

  if (isLoading) {
    return (
      <div className="results-container">
        <div className="loading">Загрузка результатов...</div>
      </div>
    );
  }

  return (
    <div className="results-container">
      <div className="section-header">
        <h2>Результаты экзаменов</h2>
      </div>

      <Filters
        filters={filters}
        groups={Array.isArray(groups) ? groups : []}
        onFilterChange={handleFilterChange}
        onClearFilters={clearFilters}
      />

      <p className="results-hint">
        Нажмите на студента для просмотра детальных результатов
      </p>

      {filteredStudents.length === 0 ? (
        <div className="no-results">
          {filters.search || filters.groupId || filters.subject ? (
            <p>Студенты не найдены по заданным фильтрам</p>
          ) : (
            <p>Нет студентов или экзаменов</p>
          )}
        </div>
      ) : (
        <div className="results-list">
          {filteredStudents.map(student => {
            const studentExams = Array.isArray(exams) 
              ? exams.filter(e => e.id_student === student.id)
              : [];
            return (
              <StudentResults
                key={student.id}
                student={student}
                exams={studentExams}
                groups={Array.isArray(groups) ? groups : []}
              />
            );
          })}
        </div>
      )}
    </div>
  );
};

export default ResultsView;