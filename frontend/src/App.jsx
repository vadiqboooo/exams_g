// src/App.jsx
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Routes, Route, useLocation } from 'react-router-dom';
import { StudentsProvider } from './hooks/useStudents';
import { ExamsProvider } from './hooks/useExams';
import { GroupsProvider } from './hooks/useGroups';
import Tabs from './components/common/Tabs';
import StudentsTab from './components/students/StudentList';
import ExamsTab from './components/exams/GroupCards';
import ResultsTab from './components/results/ResultsView';
import GroupsTab from './components/groups/GroupList';
import RegistrationsTab from './components/registrations/RegistrationsView';
import ProbnikTab from './components/probnik/ProbnikManager';
import TeachersTab from './components/teachers/TeacherList';
import SubjectsTab from './components/subjects/SubjectManager';
import ReportsTab from './components/reports/ReportsTab';
import LessonsTab from './components/lessons/LessonsTab';
import Notification from './components/common/Notification';
import Login from "./pages/Login";
import PublicResults from "./pages/PublicResults";

import './styles/App.css';

// Базовый список вкладок с ролями
const allTabs = [
  { id: 'teachers', label: 'Сотрудники', ownerOnly: true },
  { id: 'students', label: 'Студенты', roles: ['owner', 'admin', 'school_admin'] },
  { id: 'exams', label: 'Экзамены', roles: ['owner', 'admin', 'teacher'] },
  { id: 'lessons', label: 'Уроки', roles: ['owner', 'teacher', 'school_admin'] },
  { id: 'results', label: 'Результаты', roles: ['owner', 'admin', 'school_admin'] },
  { id: 'groups', label: 'Группы', roles: ['owner', 'admin', 'teacher', 'school_admin'] },
  { id: 'registrations', label: 'Записи на экзамен', roles: ['owner', 'admin', 'teacher', 'school_admin'] },
  { id: 'probnik', label: 'Пробник', ownerOnly: true },
  { id: 'subjects', label: 'Предметы', ownerOnly: true },
  { id: 'reports', label: 'Отчеты', roles: ['owner', 'school_admin'] }
];

function App() {
  const location = useLocation();

  // Проверяем, является ли текущий путь публичной страницей результатов
  const isPublicResultsPage = location.pathname.startsWith('/results/');

  // Если это публичная страница, показываем её без авторизации
  if (isPublicResultsPage) {
    return (
      <Routes>
        <Route path="/results/:token" element={<PublicResults />} />
      </Routes>
    );
  }

  // ← Проверяем авторизацию для основного приложения
  const token = localStorage.getItem("token");
  const teacherName = localStorage.getItem("teacher_name") || "Пользователь";
  const userRole = localStorage.getItem("role") || "teacher";
  const school = localStorage.getItem("school") || null;
  const isOwner = userRole === "owner" || userRole === "admin";
  const isSchoolAdmin = userRole === "school_admin";
  const isAdmin = isOwner; // Для обратной совместимости

  // Начальная вкладка: зависит от роли
  const getInitialTab = () => {
    const role = localStorage.getItem("role") || "teacher";
    if (role === "owner" || role === "admin") return 'students';
    if (role === "school_admin") return 'students';
    return 'exams';
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
    return allTabs.filter(tab => {
      // Если вкладка только для owner
      if (tab.ownerOnly) {
        return isOwner;
      }
      // Если указаны роли, проверяем вхождение
      if (tab.roles) {
        return tab.roles.includes(userRole);
      }
      return true;
    });
  }, [userRole, isOwner]);

  // Проверяем доступ к текущей вкладке
  useEffect(() => {
    const currentTab = allTabs.find(tab => tab.id === activeTab);
    if (!currentTab) return;

    let hasAccess = true;
    if (currentTab.ownerOnly && !isOwner) {
      hasAccess = false;
    } else if (currentTab.roles && !currentTab.roles.includes(userRole)) {
      hasAccess = false;
    }

    if (!hasAccess) {
      setActiveTab(getInitialTab());
    }
  }, [userRole, activeTab, isOwner]);

  // ----- ЕСЛИ ВОШЁЛ → ПОКАЗАТЬ ОСНОВНОЙ ИНТЕРФЕЙС -----
  const renderTabContent = useMemo(() => {
    switch (activeTab) {
      case 'students':
        return <StudentsTab showNotification={stableShowNotification} />;
      case 'teachers':
        return <TeachersTab showNotification={stableShowNotification} />;
      case 'exams':
        return <ExamsTab showNotification={stableShowNotification} />;
      case 'results':
        return <ResultsTab showNotification={stableShowNotification} />;
      case 'groups':
        return <GroupsTab showNotification={stableShowNotification} isAdmin={isAdmin} />;
      case 'registrations':
        return <RegistrationsTab showNotification={stableShowNotification} />;
      case 'probnik':
        return <ProbnikTab showNotification={stableShowNotification} />;
      case 'subjects':
        return <SubjectsTab showNotification={stableShowNotification} />;
      case 'reports':
        return <ReportsTab showNotification={stableShowNotification} userRole={userRole} />;
      case 'lessons':
        return <LessonsTab showNotification={stableShowNotification} />;
      default:
        return null;
    }
  }, [activeTab, stableShowNotification, isAdmin, userRole]);

  // Функция выхода (мемоизируем, чтобы не вызывать перерендеры)
  const logout = useCallback(() => {
    // Очищаем пользовательские данные сессии отчётов
    const userId = localStorage.getItem('employee_id') || localStorage.getItem('teacher_name');
    if (userId) {
      ['workStartTime', 'reportFormData', 'savedReportTabs', 'lastSavedFormData'].forEach(key => {
        localStorage.removeItem(`${key}_${userId}`);
      });
    }
    localStorage.removeItem("token");
    localStorage.removeItem("role");
    localStorage.removeItem("teacher_name");
    localStorage.removeItem("school");
    localStorage.removeItem("employee_id");
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
