import React, { useState, useEffect } from 'react';
import { useStudents } from '../../hooks/useStudents';
import StudentForm from './StudentForm';
import StudentCard from './StudentCard';
import Modal from '../common/Modal';

const StudentList = ({ showNotification }) => {
  const { students, loadStudents, deleteStudent } = useStudents();
  const [searchTerm, setSearchTerm] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchStudents = async () => {
      setIsLoading(true);
      try {
        await loadStudents();
      } catch (err) {
        showNotification('Ошибка загрузки студентов', 'error');
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchStudents();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Загружаем только при монтировании компонента

  const handleDelete = async (id, name) => {
    if (window.confirm(`Удалить студента ${name}?`)) {
      try {
        await deleteStudent(id);
        showNotification('Студент удалён', 'success');
      } catch (err) {
        showNotification('Ошибка удаления', 'error');
      }
    }
  };

  // Убедимся, что students - это массив
  const studentsArray = Array.isArray(students) ? students : [];
  
  const filteredStudents = studentsArray.filter(student => {
    if (!student || !student.fio) return false;
    return student.fio.toLowerCase().includes(searchTerm.toLowerCase());
  });

  if (isLoading) {
    return (
      <div className="students-container">
        <div className="loading">Загрузка студентов...</div>
      </div>
    );
  }

  return (
    <div className="students-container">
      <div className="section-header">
        <h2>Студенты</h2>
        <button 
          onClick={() => setShowForm(true)}
          className="btn btn-success"
        >
          ➕ Добавить студента
        </button>
      </div>

      <div className="search-section">
        <input
          type="text"
          placeholder="Поиск по ФИО..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="search-input"
        />
      </div>

      {filteredStudents.length === 0 ? (
        <div className="empty-state">
          <p>{searchTerm ? 'Студенты не найдены' : 'Нет студентов'}</p>
        </div>
      ) : (
        <div className="students-list">
          {filteredStudents.map(student => (
            <StudentCard
              key={student.id}
              student={student}
              onEdit={() => setSelectedStudent(student)}
              onDelete={() => handleDelete(student.id, student.fio)}
              showNotification={showNotification}
            />
          ))}
        </div>
      )}

      {showForm && (
        <Modal onClose={() => setShowForm(false)} size="md">
          <div className="modal-inner">
            <h2>Добавить студента</h2>
            <StudentForm
              onClose={() => setShowForm(false)}
              showNotification={showNotification}
            />
          </div>
        </Modal>
      )}

      {selectedStudent && (
        <Modal onClose={() => setSelectedStudent(null)} size="md">
          <div className="modal-inner">
            <h2>Редактировать студента</h2>
            <StudentForm
              student={selectedStudent}
              onClose={() => setSelectedStudent(null)}
              showNotification={showNotification}
            />
          </div>
        </Modal>
      )}
    </div>
  );
};

export default StudentList;