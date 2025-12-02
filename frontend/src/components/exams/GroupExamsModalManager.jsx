import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom';
import GroupExamsModal from './GroupExamsModal';

// Создаем портал для модального окна
const GroupExamsModalManager = ({ 
  group, 
  allExams, 
  onClose, 
  showNotification 
}) => {
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
    return () => setIsMounted(false);
  }, []);

  if (!isMounted || !group) return null;

  return ReactDOM.createPortal(
    <GroupExamsModal
      group={group}
      allExams={allExams}
      onClose={onClose}
      showNotification={showNotification}
    />,
    document.body
  );
};

export default GroupExamsModalManager;