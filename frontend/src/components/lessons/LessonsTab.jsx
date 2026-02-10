import { useState, useEffect, useMemo } from 'react';
import './LessonsTab.css';
import LessonsList from './LessonsList';
import LessonForm from './LessonForm';
import LessonFillForm from './LessonFillForm';

const LessonsTab = ({ showNotification }) => {
  const [view, setView] = useState('upcoming'); // upcoming, past, calendar
  const [lessons, setLessons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [selectedLesson, setSelectedLesson] = useState(null); // Для заполнения урока

  useEffect(() => {
    fetchLessons();
  }, []);

  const fetchLessons = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('http://127.0.0.1:8000/lessons/my', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error('Ошибка загрузки уроков');
      }

      const data = await response.json();
      setLessons(data);
    } catch (error) {
      console.error('Error fetching lessons:', error);
      showNotification('Ошибка загрузки уроков', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateLesson = async (lessonData) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('http://127.0.0.1:8000/lessons/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(lessonData)
      });

      if (!response.ok) {
        throw new Error('Ошибка создания урока');
      }

      showNotification('Урок создан', 'success');
      setShowCreateForm(false);
      fetchLessons();
    } catch (error) {
      console.error('Error creating lesson:', error);
      showNotification('Ошибка создания урока', 'error');
    }
  };

  const handleCancelLesson = async (lessonId, reason) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`http://127.0.0.1:8000/lessons/${lessonId}/cancel`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ reason })
      });

      if (!response.ok) {
        throw new Error('Ошибка отмены урока');
      }

      showNotification('Урок отменен', 'success');
      fetchLessons();
    } catch (error) {
      console.error('Error cancelling lesson:', error);
      showNotification('Ошибка отмены урока', 'error');
    }
  };

  const handleFillLesson = (lesson) => {
    setSelectedLesson(lesson);
  };

  const handleBackToList = () => {
    setSelectedLesson(null);
    fetchLessons();
  };

  // Разделяем уроки на предстоящие и прошедшие
  const { upcomingLessons, pastLessons } = useMemo(() => {
    const now = new Date();
    const upcoming = [];
    const past = [];

    lessons.forEach(lesson => {
      const lessonDate = new Date(lesson.lesson_date);
      if (lessonDate >= now && !lesson.is_cancelled) {
        upcoming.push(lesson);
      } else if (!lesson.is_cancelled) {
        past.push(lesson);
      }
    });

    return {
      upcomingLessons: upcoming.sort((a, b) => new Date(a.lesson_date) - new Date(b.lesson_date)),
      pastLessons: past.sort((a, b) => new Date(b.lesson_date) - new Date(a.lesson_date))
    };
  }, [lessons]);

  if (loading) {
    return <div className="lessons-loading">Загрузка уроков...</div>;
  }

  // Если выбран урок для заполнения, показываем форму заполнения
  if (selectedLesson) {
    return (
      <LessonFillForm
        lesson={selectedLesson}
        onBack={handleBackToList}
        showNotification={showNotification}
      />
    );
  }

  return (
    <div className="lessons-tab">
      <div className="lessons-header">
        <h2>Мои уроки</h2>
        <button className="btn btn-primary" onClick={() => setShowCreateForm(true)}>
          + Создать урок
        </button>
      </div>

      <div className="lessons-tabs">
        <button
          className={`tab-btn ${view === 'upcoming' ? 'active' : ''}`}
          onClick={() => setView('upcoming')}
        >
          Предстоящие ({upcomingLessons.length})
        </button>
        <button
          className={`tab-btn ${view === 'past' ? 'active' : ''}`}
          onClick={() => setView('past')}
        >
          Прошедшие ({pastLessons.length})
        </button>
        <button
          className={`tab-btn ${view === 'calendar' ? 'active' : ''}`}
          onClick={() => setView('calendar')}
        >
          Календарь
        </button>
      </div>

      <div className="lessons-content">
        {view === 'upcoming' && (
          <LessonsList
            lessons={upcomingLessons}
            onCancel={handleCancelLesson}
            onFill={handleFillLesson}
            showNotification={showNotification}
          />
        )}

        {view === 'past' && (
          <LessonsList
            lessons={pastLessons}
            onFill={handleFillLesson}
            showNotification={showNotification}
            isPast={true}
          />
        )}

        {view === 'calendar' && (
          <div className="calendar-view">
            <p>Календарный вид в разработке...</p>
          </div>
        )}
      </div>

      {showCreateForm && (
        <LessonForm
          onSubmit={handleCreateLesson}
          onClose={() => setShowCreateForm(false)}
          showNotification={showNotification}
        />
      )}
    </div>
  );
};

export default LessonsTab;
