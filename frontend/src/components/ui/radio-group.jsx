import React from 'react';
import './radio-group.css';

const RadioGroupContext = React.createContext(null);

export function RadioGroup({ value, onValueChange, className = '', children }) {
  return (
    <RadioGroupContext.Provider value={{ groupValue: value, onGroupChange: onValueChange }}>
      <div className={`radio-group ${className}`} role="radiogroup">
        {children}
      </div>
    </RadioGroupContext.Provider>
  );
}

export function RadioGroupItem({ value, id, ...props }) {
  const { groupValue, onGroupChange } = React.useContext(RadioGroupContext);
  const isChecked = groupValue === value;

  return (
    <input
      type="radio"
      id={id}
      value={value}
      checked={isChecked}
      onChange={(e) => onGroupChange(e.target.value)}
      className="radio-group-item"
      {...props}
    />
  );
}
