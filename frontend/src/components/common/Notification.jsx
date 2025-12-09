import React, { useEffect } from 'react';

const Notification = ({ message, type = 'success', onClose }) => {
  useEffect(() => {
    console.log("Notification mounted:", message, type); // Отладка
    const timer = setTimeout(() => {
      console.log("Notification auto-close"); // Отладка
      onClose();
    }, 3000);
    return () => {
      clearTimeout(timer);
    };
  }, [onClose, message, type]);

  if (!message) {
    return null;
  }

  return (
    <div className={`notification ${type}`} style={{ position: 'fixed', top: '20px', right: '20px', zIndex: 10000 }}>
      <span>{message}</span>
      <button onClick={onClose} className="notification-close" type="button">
        ×
      </button>
    </div>
  );
};

export default Notification;