import React from 'react';
import { validateTaskInput, formatTaskNumber } from '../../utils/helpers';

const TaskInput = ({ index, value, maxScore, onChange, subject, totalTasks }) => {
  const handleChange = (e) => {
    const validatedValue = validateTaskInput(e.target.value, maxScore);
    onChange(validatedValue);
  };

  const getBackgroundColor = () => {
    if (value === '' || value === '-') return '#f8f9fa';
    const score = parseInt(value) || 0;
    if (score === 0) return '#ffebee';
    if (score >= maxScore) return '#e8f5e9';
    return '#fff3e0';
  };

  const taskDisplayNumber = formatTaskNumber(index, subject, totalTasks);
  
  return (
    <div className="task-input-wrapper">
      <div className="task-number">{taskDisplayNumber}</div>
      <input
        type="text"
        value={value}
        onChange={handleChange}
        maxLength="2"
        placeholder="-"
        style={{ backgroundColor: getBackgroundColor() }}
      />
      <div className="max-score">max: {maxScore}</div>
    </div>
  );
};

export default TaskInput;