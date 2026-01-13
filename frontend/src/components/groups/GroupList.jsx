import React, { useState, useEffect, useMemo } from 'react';
import { useGroups } from '../../hooks/useGroups';
import { useStudents } from '../../hooks/useStudents';
import GroupForm from './GroupForm';
import GroupModal from './GroupModal';
import Modal from '../common/Modal';

const GroupList = ({ showNotification, isAdmin = true }) => {
  const { groups, loadGroups, deleteGroup } = useGroups();
  const { students, loadStudents } = useStudents();
  const [showForm, setShowForm] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [editingGroup, setEditingGroup] = useState(null);
  const [selectedSchool, setSelectedSchool] = useState('');

  useEffect(() => {
    loadGroups();
    loadStudents();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Загружаем только при монтировании компонента

  // Обновляем выбранную группу при изменении списка групп
  useEffect(() => {
    if (selectedGroup) {
      const updatedGroup = groups.find(g => g.id === selectedGroup.id);
      if (updatedGroup) {
        setSelectedGroup(updatedGroup);
      }
    }
  }, [groups, selectedGroup]);

  // Фильтруем группы по школе
  const filteredGroups = useMemo(() => {
    if (!selectedSchool) {
      return groups;
    }
    return groups.filter(group => group.school === selectedSchool);
  }, [groups, selectedSchool]);

  const handleSchoolChange = (e) => {
    setSelectedSchool(e.target.value);
  };

  const clearFilter = () => {
    setSelectedSchool('');
  };

  const handleDelete = async (id, name) => {
    if (window.confirm(`Удалить группу "${name}"?`)) {
      try {
        await deleteGroup(id);
        showNotification('Группа удалена', 'success');
      } catch (err) {
        showNotification('Ошибка удаления', 'error');
      }
    }
  };

  return (
    <div className="groups-tab-container">
      <div className="section-header">
        <h2>Учебные группы</h2>
        {isAdmin && (
          <button 
            onClick={() => setShowForm(true)}
            className="btn btn-success"
          >
            + Создать новую группу
          </button>
        )}
      </div>

      <div className="registrations-filters" style={{ marginBottom: '20px' }}>
        <div className="filter-group">
          <label htmlFor="school-filter">Фильтр по школе:</label>
          <select
            id="school-filter"
            value={selectedSchool}
            onChange={handleSchoolChange}
            className="date-select"
          >
            <option value="">Все школы</option>
            <option value="Лермонтова">Лермонтова</option>
            <option value="Байкальская">Байкальская</option>
          </select>
        </div>
        {selectedSchool && (
          <button onClick={clearFilter} className="btn-clear-filter">
            Сбросить фильтр
          </button>
        )}
        <div className="registrations-count">
          Всего групп: {filteredGroups.length}
        </div>
      </div>

      {filteredGroups.length === 0 ? (
        <div className="empty-state">
          <p>
            {selectedSchool 
              ? `Нет групп по выбранной школе "${selectedSchool}".` 
              : 'Нет групп. Создайте первую группу.'}
          </p>
        </div>
      ) : (
        <div className="groups-list">
          {filteredGroups.map(group => (
            <div 
              key={group.id} 
              className="group-item"
              onClick={() => setSelectedGroup(group)}
            >
              <div className="group-info">
                <h3>{group.name}</h3><p> {group.id}</p>
                <p className="group-teacher">👨‍🏫 {group.teacher_name || group.teacher || 'Не указан'}</p>
                <p className="group-stats">
                  📚 {group.students?.length || 0} учеников
                  {group.subject && ` • 📖 ${group.subject}`}
                </p>
              </div>
              
              {isAdmin && (
                <div className="group-actions" onClick={(e) => e.stopPropagation()}>
                  <button 
                    onClick={() => setEditingGroup(group)}
                    className="btn btn-secondary"
                  >
                    Редактировать
                  </button>
                  <button 
                    onClick={() => handleDelete(group.id, group.name)}
                    className="btn btn-danger"
                  >
                    Удалить
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <Modal onClose={() => setShowForm(false)} size="lg">
          <GroupForm
            students={students}
            onClose={async () => {
              await loadGroups();
              setShowForm(false);
            }}
            showNotification={showNotification}
          />
        </Modal>
      )}

      {editingGroup && (
        <Modal onClose={() => setEditingGroup(null)} size="lg">
          <GroupForm
            group={editingGroup}
            students={students}
            onClose={async () => {
              await loadGroups();
              setEditingGroup(null);
            }}
            showNotification={showNotification}
          />
        </Modal>
      )}

      {selectedGroup && (
        <GroupModal
          group={selectedGroup}
          onClose={() => setSelectedGroup(null)}
          showNotification={showNotification}
        />
      )}
    </div>
  );
};

export default GroupList;