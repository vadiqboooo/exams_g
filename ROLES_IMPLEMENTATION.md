# Реализация системы ролей и функционала администраторов школ

## Выполненные задачи

### Backend
- ✅ Модели: добавлены WorkSession, Task, Report, поле school в Employee
- ✅ Миграция базы данных (admin -> owner)
- ✅ Создание тестовых администраторов школ
- ✅ Schemas для новых моделей
- ✅ Auth: helper функции, school в токене
- ✅ CRUD операции для новых моделей
- ✅ API endpoints с фильтрацией по школам

### Frontend
- ✅ App.jsx: новые вкладки (Рабочее время, Задачи, Отчеты)
- ✅ Login.jsx: сохранение school
- ✅ TimeTrackerTab: учет рабочего времени
- ✅ TasksTab + TaskForm: система задач
- ✅ ReportsTab + ReportForm: отчеты
- ✅ TeacherForm: выбор роли и школы
- ✅ TeacherList: отображение роли и школы

## Запуск миграции

1. Запустите миграцию базы данных:
```bash
cd backend
python migrate_roles.py
```

2. Создайте администраторов школ:
```bash
python create_school_admin.py
```

3. Исправьте названия школ (если уже создавали ранее):
```bash
python fix_school_names.py
```

**ВАЖНО**: После обновления данных в БД нужно перезапустить backend и перелогиниться в приложении!

## Данные для входа

### Owner (существующий admin)
- Username: (ваш существующий admin username)
- Password: (ваш существующий admin password)
- Роль: owner (автоматически мигрирован)

### Администратор Байкальская
- Username: `admin_baikalskaya`
- Password: `baikalskaya123`
- Школа: Байкальская
- Роль: school_admin
- Групп: ~26

### Администратор Лермонтова
- Username: `admin_lermontova`
- Password: `lermontova123`
- Школа: Лермонтова
- Роль: school_admin
- Групп: ~4

## Функционал по ролям

### Owner (admin)
- Полный доступ ко всему
- Видит все вкладки
- Управляет учителями и администраторами школ
- Создает задачи для school_admin
- Видит рабочее время и отчеты всех администраторов

### School Admin
- Видит только данные своей школы
- Доступные вкладки: Студенты, Результаты, Группы, Записи на экзамен
- Рабочее время: может начинать/завершать сессии
- Задачи: видит свои задачи, может менять статус
- Отчеты: создает отчеты для owner
- НЕ может управлять учителями и предметами

### Teacher
- Остается без изменений
- Доступные вкладки: Экзамены, Группы, Записи на экзамен

## Новые вкладки

### Рабочее время
- School admin: начать/закончить работу, просмотр своей истории
- Owner: просмотр истории всех администраторов

### Задачи
- Owner: создание задач, назначение администраторам
- School admin: просмотр своих задач, изменение статуса

### Отчеты
- School admin: создание отчетов
- Owner: просмотр всех отчетов

## API Endpoints

### Work Sessions
- POST `/work-sessions/start` - начать сессию
- POST `/work-sessions/{id}/end` - завершить сессию
- GET `/work-sessions/` - история сессий
- GET `/work-sessions/active` - активная сессия

### Tasks
- POST `/tasks/` - создать задачу (owner only)
- GET `/tasks/` - получить задачи
- PUT `/tasks/{id}` - обновить задачу

### Reports
- POST `/reports/` - создать отчет
- GET `/reports/` - получить отчеты

### Employees
- GET `/employees/?role=school_admin` - список администраторов (owner only)

## Фильтрация по школам

- `/groups/` и `/groups-with-students/` - school_admin видит только группы своей школы
- `/students/` - school_admin видит только студентов из групп своей школы
- `/exam-registrations/` - school_admin видит только записи своей школы

## Permissions

- `/teachers/` (POST/PUT/DELETE) - только owner
- `/subjects/` (POST/PUT/DELETE) - только owner
- Все новые endpoints - owner + school_admin

## Проверка функционала

1. Войдите как owner - проверьте полный доступ
2. Войдите как admin_baikalskaya - проверьте фильтрацию по школе
3. Войдите как admin_lermontova - проверьте фильтрацию по другой школе
4. Проверьте учет времени
5. Создайте задачу от owner, проверьте от school_admin
6. Создайте отчет от school_admin, проверьте от owner
