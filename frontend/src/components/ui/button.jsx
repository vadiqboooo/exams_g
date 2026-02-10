import React from 'react';
import './button.css';

export function Button({
  children,
  className = '',
  variant = 'default',
  size = 'default',
  ...props
}) {
  return (
    <button
      className={`button button-${variant} button-${size} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
