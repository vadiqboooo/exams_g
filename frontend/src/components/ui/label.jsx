import React from 'react';
import './label.css';

export function Label({ children, className = '', htmlFor, ...props }) {
  return (
    <label
      htmlFor={htmlFor}
      className={`label ${className}`}
      {...props}
    >
      {children}
    </label>
  );
}
