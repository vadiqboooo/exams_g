import React from 'react';

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
                {group.name || group.teacher || `Группа ${group.id}`}
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
            <option value="rus">Русский язык</option>
            <option value="math_profile">Математика (профильная)</option>
            <option value="math_base">Математика (базовая)</option>
            <option value="phys">Физика</option>
            <option value="infa">Информатика</option>
            <option value="bio">Биология</option>
            <option value="hist">История</option>
            <option value="soc">Обществознание</option>
            <option value="eng">Английский язык</option>
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