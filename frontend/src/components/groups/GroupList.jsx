import React, { useState, useEffect } from 'react';
import { useGroups } from '../../hooks/useGroups';
import { useStudents } from '../../hooks/useStudents';
import GroupForm from './GroupForm';
import GroupModal from './GroupModal';
import Modal from '../common/Modal';

const GroupList = ({ showNotification }) => {
  const { groups, loadGroups, deleteGroup } = useGroups();
  const { students, loadStudents } = useStudents();
  const [showForm, setShowForm] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [editingGroup, setEditingGroup] = useState(null);

  useEffect(() => {
    loadGroups();
    loadStudents();
  }, [loadGroups, loadStudents]);

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
        <button 
          onClick={() => setShowForm(true)}
          className="btn btn-success"
        >
          + Создать новую группу
        </button>
      </div>

      {groups.length === 0 ? (
        <div className="empty-state">
          <p>Нет групп. Создайте первую группу.</p>
        </div>
      ) : (
        <div className="groups-list">
          {groups.map(group => (
            <div key={group.id} className="group-item">
              <div className="group-info">
                <h3>{group.name}</h3>
                <p className="group-teacher">👨‍🏫 {group.teacher}</p>
                <p className="group-stats">
                  📚 {group.students?.length || 0} учеников
                  {group.subject && ` • 📖 ${group.subject}`}
                </p>
              </div>
              
              <div className="group-actions">
                <button 
                  onClick={() => setSelectedGroup(group)}
                  className="btn btn-primary"
                >
                  Открыть
                </button>
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
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <Modal onClose={() => setShowForm(false)} size="lg">
          <GroupForm
            students={students}
            onClose={() => setShowForm(false)}
            showNotification={showNotification}
          />
        </Modal>
      )}

      {editingGroup && (
        <Modal onClose={() => setEditingGroup(null)} size="lg">
          <GroupForm
            group={editingGroup}
            students={students}
            onClose={() => setEditingGroup(null)}
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