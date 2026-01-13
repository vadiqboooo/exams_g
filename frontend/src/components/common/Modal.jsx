import React, { useEffect } from 'react';
import './Modal.css'; 

const Modal = ({ children, onClose, size = 'md', className = '' }) => {
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape') onClose();
    };
    
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) onClose();
  };

  const sizeClasses = {
    sm: 'max-w-md',
    md: 'max-w-2xl',
    lg: 'max-w-4xl',
    xl: 'max-w-6xl'
  };

  const modalClass = className 
    ? className 
    : `modal-content ${sizeClasses[size]}`;

  return (
    <div className="modal-backdrop" onClick={handleBackdropClick}>
      <div 
        className={modalClass}
        onClick={(e) => e.stopPropagation()}  
      >
        {children}
      </div>
    </div>
  );
};

export default Modal;
