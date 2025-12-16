# Исправление проблемы с запросами frontend к backend

## Проблема
Frontend не отправляет запросы на backend.

## Решения

### 1. Для работы в Docker (production)

✅ **Исправлено**: Добавлен путь `/telegram` в nginx конфигурацию для проксирования запросов.

Nginx теперь проксирует следующие пути к backend:
- `/auth`
- `/students`
- `/exams`
- `/groups`
- `/teachers`
- `/exam-types`
- `/telegram` ← **НОВОЕ**

### 2. Для локальной разработки

Создайте файл `.env` в папке `exams_g/frontend/`:

```env
VITE_API_BASE_URL=http://localhost:8000
```

Это нужно, чтобы frontend знал, куда отправлять запросы при локальной разработке.

### 3. Проверка CORS в backend

Backend уже настроен для приема запросов с:
- `http://localhost:5173` (Vite dev server)
- `http://127.0.0.1:5173`
- `http://localhost:3000`
- `http://127.0.0.1:3000`
- `http://localhost:8000`
- `http://127.0.0.1:8000`

Если вы используете другой порт, добавьте его в переменную окружения `CORS_ORIGINS` в backend.

### 4. Как проверить, что все работает

1. **В Docker:**
   ```bash
   docker-compose up --build
   ```
   Frontend должен быть доступен на `http://localhost`
   Backend должен быть доступен на `http://localhost:8000`

2. **Локально:**
   - Запустите backend: `cd exams_g/backend && uvicorn main:app --reload`
   - Создайте `.env` файл в `exams_g/frontend/` с `VITE_API_BASE_URL=http://localhost:8000`
   - Запустите frontend: `cd exams_g/frontend && npm run dev`

3. **Проверка в браузере:**
   - Откройте DevTools (F12)
   - Перейдите на вкладку Network
   - Попробуйте выполнить действие в приложении
   - Проверьте, отправляются ли запросы и какой у них статус

### 5. Частые проблемы

**Проблема**: Запросы идут на `http://localhost/students` вместо `http://localhost:8000/students`

**Решение**: Убедитесь, что:
- В Docker: `VITE_API_BASE_URL` пустой (или не установлен)
- Локально: `VITE_API_BASE_URL=http://localhost:8000` в `.env` файле

**Проблема**: CORS ошибка в консоли браузера

**Решение**: 
- Проверьте, что backend запущен
- Проверьте, что URL в `CORS_ORIGINS` совпадает с URL frontend
- Убедитесь, что backend принимает запросы (проверьте `/docs` endpoint)

**Проблема**: 404 ошибка для `/telegram/*` endpoints

**Решение**: 
- Убедитесь, что nginx конфигурация обновлена (путь `/telegram` добавлен)
- Пересоберите Docker контейнер: `docker-compose up --build`


