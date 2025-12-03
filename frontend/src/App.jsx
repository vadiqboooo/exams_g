// src/App.jsx
import React, { useState } from 'react';
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

const tabs = [
  { id: 'students', label: 'Студенты' },
  { id: 'exams', label: 'Экзамены' },
  { id: 'results', label: 'Результаты' },
  { id: 'groups', label: 'Группы' }
];

function App() {
  const [activeTab, setActiveTab] = useState('students');
  const [notification, setNotification] = useState(null);

  // ← Проверяем авторизацию
  const token = localStorage.getItem("token");

  const showNotification = (message, type = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3000);
  };

  // ----- ЕСЛИ НЕТ ТОКЕНА → ПОКАЗАТЬ ЛОГИН -----
  if (!token) {
    return <Login showNotification={showNotification} />;
  }

  // ----- ЕСЛИ ВОШЁЛ → ПОКАЗАТЬ ОСНОВНОЙ ИНТЕРФЕЙС -----
  const renderTabContent = () => {
    switch (activeTab) {
      case 'students':
        return <StudentsTab showNotification={showNotification} />;
      case 'exams':
        return <ExamsTab showNotification={showNotification} />;
      case 'results':
        return <ResultsTab showNotification={showNotification} />;
      case 'groups':
        return <GroupsTab showNotification={showNotification} />;
      default:
        return null;
    }
  };

  // Функция выхода
  const logout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("role");
    localStorage.removeItem("teacher_name");
    window.location.reload();
  };

  return (
    <StudentsProvider>
      <ExamsProvider>
        <GroupsProvider>
          <div className="app">
            <header className="app-header">
              <h1>Система учета студентов и экзаменов</h1>
              <button onClick={logout} className="logout-btn">Выйти</button>
            </header>

            <Tabs 
              tabs={tabs} 
              activeTab={activeTab} 
              onTabChange={setActiveTab} 
            />

            <main className="app-main">
              {renderTabContent()}
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
