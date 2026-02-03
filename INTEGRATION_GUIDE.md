# Руководство по интеграции системы управления предметами

## Что уже готово ✅

1. ✅ Backend API для управления предметами
2. ✅ База данных с таблицей `subjects`
3. ✅ Миграция применена
4. ✅ 20 предметов импортированы в БД
5. ✅ Frontend компоненты для управления предметами
6. ✅ Интеграция в главное меню приложения

## Что нужно сделать для полной интеграции

### Шаг 1: Обновить constants.js для получения данных из API

Вместо жестко закодированных констант, нужно создать функцию для загрузки предметов из API.

**Создайте новый файл:** `frontend/src/services/subjectsApi.js`

```javascript
import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_BASE_URL ||
                 (import.meta.env.DEV ? 'http://127.0.0.1:8000' : '');

const getAuthHeaders = () => {
  const token = localStorage.getItem('token');
  return token ? { Authorization: `Bearer ${token}` } : {};
};

let subjectsCache = null;

export const loadSubjects = async () => {
  try {
    const response = await axios.get(`${API_BASE}/subjects/?only_active=true`, {
      headers: getAuthHeaders()
    });

    // Преобразуем в формат SUBJECT_TASKS
    const subjects = {};
    response.data.forEach(subject => {
      subjects[subject.code] = {
        name: subject.name,
        tasks: subject.tasks_count,
        maxPerTask: subject.max_per_task
      };
    });

    subjectsCache = subjects;
    return subjects;
  } catch (error) {
    console.error('Ошибка загрузки предметов:', error);
    // Fallback на константы если API недоступен
    return null;
  }
};

export const getSubjects = () => subjectsCache;
```

**Обновите constants.js:**

```javascript
import { getSubjects } from './subjectsApi';

// Статичный fallback на случай, если API недоступен
const FALLBACK_SUBJECT_TASKS = {
  'rus': { name: 'Русский язык', tasks: 27, maxPerTask: [1,1,1,1,1,1,1,2,1,1,1,1,1,1,1,1,1,1,1,1,1,2,1,1,1,1,22] },
  // ... остальные предметы
};

export const SUBJECT_TASKS = getSubjects() || FALLBACK_SUBJECT_TASKS;

// Остальной код...
```

**В App.jsx добавьте загрузку предметов при старте:**

```javascript
import { loadSubjects } from './services/subjectsApi';

useEffect(() => {
  loadSubjects();
}, []);
```

### Шаг 2: Обновить calculations.js для динамической работы

**Обновите функцию calculateTotalScore:**

```javascript
export function calculateTotalScore(subject, answers, subjectConfig) {
  if (!answers || answers.length === 0) return 0;

  const primary = calculatePrimaryScore(answers, subject, subjectConfig?.maxPerTask);

  // Если есть таблица перевода баллов, используем её
  if (subjectConfig?.primary_to_secondary_scale) {
    const scale = subjectConfig.primary_to_secondary_scale;
    return primary < scale.length ? scale[primary] : (scale[scale.length - 1] || 100);
  }

  // Fallback на старые константы
  if (subject === 'math_profile') {
    const scale = [0, 6, 11, 17, ...];
    return primary < scale.length ? scale[primary] : 100;
  }

  // ... остальные fallback'и

  return primary;
}
```

### Шаг 3: Обновить компоненты для работы с динамическими данными

**В GroupExamsModal.jsx:**

```javascript
import { loadSubjects, getSubjects } from '../../services/subjectsApi';

// В useEffect загружаем предметы
useEffect(() => {
  loadSubjects();
}, []);

// Используем getSubjects() вместо SUBJECT_TASKS
const subjects = getSubjects();
const mainSubjectConfig = subjects?.[mainSubject];
```

### Шаг 4: Создать hook для работы с предметами (опционально)

**Создайте:** `frontend/src/hooks/useSubjects.jsx`

```javascript
import { createContext, useContext, useState, useEffect } from 'react';
import { loadSubjects } from '../services/subjectsApi';

const SubjectsContext = createContext();

export const SubjectsProvider = ({ children }) => {
  const [subjects, setSubjects] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const data = await loadSubjects();
      setSubjects(data);
      setLoading(false);
    };
    load();
  }, []);

  return (
    <SubjectsContext.Provider value={{ subjects, loading }}>
      {children}
    </SubjectsContext.Provider>
  );
};

export const useSubjects = () => {
  const context = useContext(SubjectsContext);
  if (!context) {
    throw new Error('useSubjects must be used within SubjectsProvider');
  }
  return context;
};
```

**Оберните App в SubjectsProvider:**

```javascript
<SubjectsProvider>
  <StudentsProvider>
    <ExamsProvider>
      <GroupsProvider>
        {/* Остальной код */}
      </GroupsProvider>
    </ExamsProvider>
  </StudentsProvider>
</SubjectsProvider>
```

### Шаг 5: Обновить формы выбора предмета

**В формах, где выбирается предмет, используйте данные из API:**

```javascript
import { useSubjects } from '../../hooks/useSubjects';

const MyComponent = () => {
  const { subjects, loading } = useSubjects();

  if (loading) return <div>Загрузка...</div>;

  return (
    <select>
      {Object.entries(subjects || {}).map(([code, config]) => (
        <option key={code} value={code}>
          {config.name}
        </option>
      ))}
    </select>
  );
};
```

## Проверка работоспособности

### 1. Проверка Backend

```bash
# Запустите сервер
cd backend
python main.py

# В другом терминале проверьте API
curl http://localhost:8000/subjects/
```

### 2. Проверка Frontend

```bash
# Запустите фронтенд
cd frontend
npm run dev

# Войдите как администратор
# Перейдите на вкладку "Предметы"
# Попробуйте создать/редактировать предмет
```

### 3. Проверка интеграции

1. Создайте новый предмет через веб-интерфейс
2. Деактивируйте несколько предметов
3. Проверьте, что в формах создания экзаменов отображаются только активные предметы
4. Проверьте расчет баллов для нового предмета

## Возможные проблемы и решения

### Проблема: Не загружаются предметы из API

**Решение:**
- Проверьте, что backend сервер запущен
- Проверьте токен авторизации
- Откройте консоль браузера и проверьте ошибки сети

### Проблема: Старые данные из constants.js

**Решение:**
- Очистите кеш браузера
- Перезапустите dev сервер
- Проверьте, что loadSubjects() вызывается при старте приложения

### Проблема: Расчет баллов работает некорректно

**Решение:**
- Проверьте, что таблица перевода баллов корректна в БД
- Проверьте, что массив maxPerTask имеет правильную длину
- Добавьте логирование для отладки

## Рекомендации по развертыванию

1. **Перед развертыванием:**
   - Создайте резервную копию БД
   - Примените все миграции
   - Импортируйте предметы

2. **При развертывании:**
   - Обновите переменные окружения (VITE_API_BASE_URL)
   - Соберите фронтенд (npm run build)
   - Перезапустите backend сервер

3. **После развертывания:**
   - Проверьте доступность API
   - Протестируйте создание/редактирование предметов
   - Проверьте расчет баллов

## Заключение

После выполнения всех шагов система будет полностью интегрирована:
- Предметы управляются через веб-интерфейс
- Данные хранятся в БД
- Расчет баллов работает динамически
- Формы используют актуальные данные из API

Если возникнут вопросы или проблемы, обратитесь к документации или логам сервера.
