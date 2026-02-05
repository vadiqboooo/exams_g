import React, { useState, useEffect } from 'react';
import { useApi } from '../../hooks/useApi';
import SubjectForm from './SubjectForm';
import SubjectList from './SubjectList';
import './SubjectManager.css';

const SubjectManager = () => {
  const [subjects, setSubjects] = useState([]);
  const [selectedSubject, setSelectedSubject] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [filter, setFilter] = useState('all'); // all, ЕГЭ, ОГЭ
  const { makeRequest, loading, error } = useApi();

  const loadSubjects = async () => {
    try {
      const data = await makeRequest('GET', '/subjects/');
      setSubjects(data);
    } catch (err) {
      console.error('Ошибка загрузки предметов:', err);
    }
  };

  useEffect(() => {
    loadSubjects();
  }, []);

  const handleCreate = () => {
    setSelectedSubject(null);
    setShowForm(true);
  };

  const handleEdit = (subject) => {
    setSelectedSubject(subject);
    setShowForm(true);
  };

  const handleDelete = async (subjectId) => {
    if (!window.confirm('Удалить этот предмет? Это действие нельзя отменить.')) return;

    try {
      await makeRequest('DELETE', `/subjects/${subjectId}`);
      await loadSubjects();
    } catch (err) {
      console.error('Ошибка удаления предмета:', err);
      alert('Ошибка удаления предмета: ' + (err.response?.data?.detail || err.message));
    }
  };

  const handleFormClose = () => {
    setShowForm(false);
    setSelectedSubject(null);
  };

  const handleFormSuccess = async () => {
    await loadSubjects();
    handleFormClose();
  };

  const handleToggleActive = async (subject) => {
    try {
      await makeRequest('PUT', `/subjects/${subject.id}`, {
        is_active: !subject.is_active
      });
      await loadSubjects();
    } catch (err) {
      console.error('Ошибка обновления статуса:', err);
    }
  };

  const filteredSubjects = subjects.filter(s => {
    if (filter === 'all') return true;
    return s.exam_type === filter;
  });

  return (
    <div className="subject-manager">
      {!showForm ? (
        <>
          {/* Режим списка */}
          <div className="subject-manager-header">
            <h1>Управление предметами</h1>
            <button onClick={handleCreate} className="btn-primary">
              ➕ Добавить предмет
            </button>
          </div>

          {error && (
            <div className="error-message">
              Ошибка: {error}
            </div>
          )}

          <div className="subject-filters">
            <button
              className={`filter-btn ${filter === 'all' ? 'active' : ''}`}
              onClick={() => setFilter('all')}
            >
              Все ({subjects.length})
            </button>
            <button
              className={`filter-btn ${filter === 'ЕГЭ' ? 'active' : ''}`}
              onClick={() => setFilter('ЕГЭ')}
            >
              ЕГЭ ({subjects.filter(s => s.exam_type === 'ЕГЭ').length})
            </button>
            <button
              className={`filter-btn ${filter === 'ОГЭ' ? 'active' : ''}`}
              onClick={() => setFilter('ОГЭ')}
            >
              ОГЭ ({subjects.filter(s => s.exam_type === 'ОГЭ').length})
            </button>
          </div>

          {loading ? (
            <div className="loading">Загрузка...</div>
          ) : (
            <SubjectList
              subjects={filteredSubjects}
              onEdit={handleEdit}
              onDelete={handleDelete}
              onToggleActive={handleToggleActive}
            />
          )}
        </>
      ) : (
        <>
          {/* Режим редактирования */}
          <div className="subject-form-header">
            <button onClick={handleFormClose} className="btn-back">
              ← Назад к списку
            </button>
            <h1>{selectedSubject ? 'Редактировать предмет' : 'Добавить предмет'}</h1>
          </div>

          <SubjectForm
            subject={selectedSubject}
            onClose={handleFormClose}
            onSuccess={handleFormSuccess}
          />
        </>
      )}
    </div>
  );
};

export default SubjectManager;
