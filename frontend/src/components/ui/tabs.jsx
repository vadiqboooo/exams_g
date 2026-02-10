import React, { createContext, useContext, useState } from 'react';
import './tabs.css';

const TabsContext = createContext();

export function Tabs({ children, defaultValue, className = '', value: controlledValue, onValueChange }) {
  const [internalValue, setInternalValue] = useState(defaultValue);

  const value = controlledValue !== undefined ? controlledValue : internalValue;
  const setValue = controlledValue !== undefined ? onValueChange : setInternalValue;

  return (
    <TabsContext.Provider value={{ value, setValue }}>
      <div className={`tabs ${className}`}>
        {children}
      </div>
    </TabsContext.Provider>
  );
}

export function TabsList({ children, className = '' }) {
  return (
    <div className={`tabs-list ${className}`}>
      {children}
    </div>
  );
}

export function TabsTrigger({ children, value, className = '' }) {
  const { value: selectedValue, setValue } = useContext(TabsContext);
  const isActive = selectedValue === value;

  return (
    <button
      type="button"
      className={`tabs-trigger ${isActive ? 'active' : ''} ${className}`}
      onClick={() => setValue(value)}
    >
      {children}
    </button>
  );
}

export function TabsContent({ children, value, className = '' }) {
  const { value: selectedValue } = useContext(TabsContext);

  if (selectedValue !== value) return null;

  return (
    <div className={`tabs-content ${className}`}>
      {children}
    </div>
  );
}
