// src/App.jsx
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { StudentsProvider } from './hooks/useStudents';
import { ExamsProvider } from './hooks/useExams';
import { GroupsProvider } from './hooks/useGroups';
import Tabs from './components/common/Tabs';
import StudentsTab from './components/students/StudentList';
import ExamsTab from './components/exams/GroupCards';
import ResultsTab from './components/results/ResultsView';
import GroupsTab from './components/groups/GroupList';
import Notification from './components/common/Notification';
import Login from "./pages/Login";

import './styles/App.css';

// Базовый список вкладок
const allTabs = [
  { id: 'students', label: 'Студенты', adminOnly: true },
  { id: 'exams', label: 'Экзамены', adminOnly: false },
  { id: 'results', label: 'Результаты', adminOnly: true },
  { id: 'groups', label: 'Группы', adminOnly: false }
];

function App() {
  // ← Проверяем авторизацию
  const token = localStorage.getItem("token");
  const teacherName = localStorage.getItem("teacher_name") || "Пользователь";
  const userRole = localStorage.getItem("role") || "teacher";
  const isAdmin = userRole === "admin";
  
  // Начальная вкладка: для учителей - "Экзамены", для админов - "Студенты"
  const getInitialTab = () => {
    const role = localStorage.getItem("role") || "teacher";
    return role === "admin" ? 'students' : 'exams';
  };
  
  const [activeTab, setActiveTab] = useState(getInitialTab);
  const [notification, setNotification] = useState(null);
  const [showUserMenu, setShowUserMenu] = useState(false);

  // Мемоизируем функцию showNotification, чтобы не вызывать перерендеры
  const stableShowNotification = useCallback((message, type = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3000);
  }, []);

  // ----- ЕСЛИ НЕТ ТОКЕНА → ПОКАЗАТЬ ЛОГИН -----
  if (!token) {
    return <Login showNotification={stableShowNotification} />;
  }

  // Фильтруем вкладки в зависимости от роли
  const availableTabs = useMemo(() => {
    return allTabs.filter(tab => isAdmin || !tab.adminOnly);
  }, [isAdmin]);

  // Если учитель пытается открыть вкладку "Студенты" или "Результаты", перенаправляем на "Экзамены"
  useEffect(() => {
    if (!isAdmin && (activeTab === 'students' || activeTab === 'results')) {
      setActiveTab('exams');
    }
  }, [isAdmin, activeTab]);

  // ----- ЕСЛИ ВОШЁЛ → ПОКАЗАТЬ ОСНОВНОЙ ИНТЕРФЕЙС -----
  const renderTabContent = useMemo(() => {
    // Если учитель пытается открыть вкладку студентов или результатов, показываем экзамены
    if (!isAdmin && (activeTab === 'students' || activeTab === 'results')) {
      return <ExamsTab showNotification={stableShowNotification} />;
    }
    
    switch (activeTab) {
      case 'students':
        return <StudentsTab showNotification={stableShowNotification} />;
      case 'exams':
        return <ExamsTab showNotification={stableShowNotification} />;
      case 'results':
        return <ResultsTab showNotification={stableShowNotification} />;
      case 'groups':
        return <GroupsTab showNotification={stableShowNotification} isAdmin={isAdmin} />;
      default:
        return null;
    }
  }, [activeTab, stableShowNotification, isAdmin]);

  // Функция выхода (мемоизируем, чтобы не вызывать перерендеры)
  const logout = useCallback(() => {
    localStorage.removeItem("token");
    localStorage.removeItem("role");
    localStorage.removeItem("teacher_name");
    window.location.reload();
  }, []);

  // Мемоизируем обработчики для предотвращения перерендеров
  const handleMenuToggle = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setShowUserMenu(prev => !prev);
  }, []);

  const handleLogout = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    logout();
  }, [logout]);

  // Закрытие меню при клике вне его
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (showUserMenu && !event.target.closest('.user-menu-container')) {
        setShowUserMenu(false);
      }
    };

    if (showUserMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showUserMenu]);

  // Мемоизируем header, чтобы он не вызывал перерендер всего приложения
  const headerContent = useMemo(() => (
    <header className="app-header">
      <h1>Система учета студентов и экзаменов</h1>
      <div className="user-menu-container">
        <button 
          onClick={handleMenuToggle}
          className="user-menu-btn"
          type="button"
        >
          <span className="user-name">👤 {teacherName}</span>
          <span className="menu-arrow">{showUserMenu ? '▲' : '▼'}</span>
        </button>
        {showUserMenu && (
          <div className="user-menu-dropdown" onClick={(e) => e.stopPropagation()}>
            <button 
              onClick={handleLogout}
              className="logout-menu-btn"
              type="button"
            >
              Выйти
            </button>
          </div>
        )}
      </div>
    </header>
  ), [teacherName, showUserMenu, handleMenuToggle, handleLogout]);

  return (
    <StudentsProvider>
      <ExamsProvider>
        <GroupsProvider>
          <div className="app">
            {headerContent}

            <Tabs 
              tabs={availableTabs} 
              activeTab={activeTab} 
              onTabChange={setActiveTab} 
            />

            <main className="app-main">
              {renderTabContent}
            </main>

            {notification && (
              <Notification
                message={notification.message}
                type={notification.type}
                onClose={() => setNotification(null)}
              />
            )}
          </div>
        </GroupsProvider>
      </ExamsProvider>
    </StudentsProvider>
  );
}

export default App;
