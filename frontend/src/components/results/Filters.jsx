import React from 'react';
import { SUBJECT_OPTIONS } from '../../services/constants';

const Filters = ({ filters, groups, onFilterChange, onClearFilters }) => {
  // Убедимся, что groups - это массив
  const groupsArray = Array.isArray(groups) ? groups : [];

  return (
    <div className="filters-section">
      <div className="filter-controls">
        <div className="form-group">
          <label>Поиск студента</label>
          <input
            type="text"
            value={filters.search}
            onChange={(e) => onFilterChange('search', e.target.value)}
            placeholder="Введите имя..."
          />
        </div>

        <div className="form-group">
          <label>Группа</label>
          <select
            value={filters.groupId}
            onChange={(e) => onFilterChange('groupId', e.target.value)}
          >
            <option value="">Все группы</option>
            {groupsArray.map(group => (
              <option key={group.id} value={group.id}>
                {group.name || group.teacher_name || group.teacher || `Группа ${group.id}`}
              </option>
            ))}
          </select>
        </div>

        <div className="form-group">
          <label>Предмет</label>
          <select
            value={filters.subject}
            onChange={(e) => onFilterChange('subject', e.target.value)}
          >
            <option value="">Все предметы</option>
            {SUBJECT_OPTIONS.map(option => (
              <option key={option.value} value={option.value}>
                {option.value.endsWith('_9') ? `${option.label} (ОГЭ)` : option.label}
              </option>
            ))}
          </select>
        </div>

        <button 
          onClick={onClearFilters} 
          className="btn btn-secondary"
        >
          Сбросить фильтры
        </button>
      </div>
    </div>
  );
};

export default Filters;