import React from 'react';
import './input.css';

export function Input({ className = '', ...props }) {
  return (
    <input
      className={`input ${className}`}
      {...props}
    />
  );
}
