import React from 'react';
import './textarea.css';

export function Textarea({ className = '', ...props }) {
  return (
    <textarea
      className={`textarea ${className}`}
      {...props}
    />
  );
}
