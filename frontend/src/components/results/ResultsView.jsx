import React, { useState, useEffect } from 'react';
import { useStudents } from '../../hooks/useStudents';
import { useExams } from '../../hooks/useExams';
import { useGroups } from '../../hooks/useGroups';
import { SUBJECT_TASKS } from '../../services/constants';
import StudentResults from './StudentResults';
import Filters from './Filters';

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
  
  // Определяем роль пользователя
  const userRole = localStorage.getItem("role") || "teacher";
  const isAdmin = userRole === "admin";

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Загружаем только при монтировании компонента

  useEffect(() => {
    // Убедимся, что все данные - массивы
    const studentsArray = Array.isArray(students) ? students : [];
    const examsArray = Array.isArray(exams) ? exams : [];
    const groupsArray = Array.isArray(groups) ? groups : [];

    let result = [...studentsArray];

    // Для учителей: показываем только студентов из их групп
    if (!isAdmin) {
      // Получаем все ID студентов из групп учителя
      const teacherGroupStudentIds = new Set();
      groupsArray.forEach(group => {
        if (group.students && Array.isArray(group.students)) {
          group.students.forEach(student => {
            teacherGroupStudentIds.add(student.id);
          });
        }
      });
      
      // Фильтруем студентов только из групп учителя
      result = result.filter(s => teacherGroupStudentIds.has(s.id));
    }

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
  }, [students, exams, groups, filters, isAdmin]);

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
            // Получаем все экзамены студента
            let studentExams = Array.isArray(exams) 
              ? exams.filter(e => e.id_student === student.id)
              : [];
            
            // Для учителей: фильтруем экзамены по предметам групп учителя, в которых состоит студент
            if (!isAdmin) {
              const groupsArray = Array.isArray(groups) ? groups : [];
              // Находим группы учителя, в которых состоит студент (все группы уже принадлежат учителю)
              const teacherGroupsWithStudent = groupsArray.filter(group => 
                group.students?.some(s => s.id === student.id)
              );
              
              // Получаем предметы из групп учителя (нормализованные)
              const teacherGroupSubjects = new Set();
              teacherGroupsWithStudent.forEach(group => {
                if (group.subject) {
                  const normalizedSubject = normalizeSubject(group.subject);
                  if (normalizedSubject) {
                    teacherGroupSubjects.add(normalizedSubject);
                    // Также добавляем полное название, если оно отличается
                    if (normalizedSubject !== group.subject) {
                      teacherGroupSubjects.add(group.subject);
                    }
                  }
                }
              });
              
              // Фильтруем экзамены только по предметам групп учителя
              if (teacherGroupSubjects.size > 0) {
                studentExams = studentExams.filter(exam => {
                  if (!exam.subject) return false;
                  // Проверяем как ключ, так и нормализованное значение
                  const normalizedExamSubject = normalizeSubject(exam.subject);
                  return teacherGroupSubjects.has(exam.subject) || teacherGroupSubjects.has(normalizedExamSubject);
                });
              } else {
                // Если у студента нет групп учителя с предметами, не показываем экзамены
                studentExams = [];
              }
            }
            
            return (
              <StudentResults
                key={student.id}
                student={student}
                exams={studentExams}
                groups={Array.isArray(groups) ? groups : []}
                showNotification={showNotification}
                onStudentUpdate={loadStudents}
              />
            );
          })}
        </div>
      )}
    </div>
  );
};

export default ResultsView;