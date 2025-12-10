# Docker Setup для Exams System

Этот проект использует Docker и Docker Compose для упрощения развертывания.

## Требования

- Docker (версия 20.10 или выше)
- Docker Compose (версия 1.29 или выше)

## Быстрый старт

1. **Клонируйте репозиторий** (если еще не сделано)

2. **Запустите проект:**
   ```bash
   docker-compose up -d
   ```

3. **Откройте в браузере:**
   - Frontend: http://localhost
   - Backend API: http://localhost:8000
   - API документация: http://localhost:8000/docs

## Структура проекта

```
.
├── docker-compose.yml          # Конфигурация Docker Compose
├── exams_g/
│   ├── backend/
│   │   ├── Dockerfile          # Dockerfile для backend
│   │   ├── requirements.txt    # Python зависимости
│   │   └── ...
│   └── frontend/
│       ├── Dockerfile          # Dockerfile для frontend
│       ├── nginx.conf          # Конфигурация Nginx
│       └── ...
```

## Команды

### Запуск проекта
```bash
docker-compose up -d
```

### Остановка проекта
```bash
docker-compose down
```

### Просмотр логов
```bash
# Все сервисы
docker-compose logs -f

# Только backend
docker-compose logs -f backend

# Только frontend
docker-compose logs -f frontend
```

### Пересборка образов
```bash
docker-compose build --no-cache
docker-compose up -d
```

### Остановка и удаление контейнеров, сетей и volumes
```bash
docker-compose down -v
```

## Переменные окружения

### Backend

Вы можете настроить CORS origins через переменную окружения:

```bash
# В docker-compose.yml добавьте в секцию backend:
environment:
  - CORS_ORIGINS=http://localhost,http://yourdomain.com
```

### Frontend

Frontend использует Nginx для раздачи статических файлов и проксирования API запросов.

## База данных

По умолчанию используется SQLite база данных, которая сохраняется в `./exams_g/backend/school.db`.

**Важно:** Файл базы данных монтируется как volume, поэтому данные сохраняются между перезапусками контейнеров.

## Проблемы и решения

### Порт уже занят

Если порт 80 или 8000 уже занят, измените порты в `docker-compose.yml`:

```yaml
services:
  frontend:
    ports:
      - "8080:80"  # Измените 8080 на нужный порт
  backend:
    ports:
      - "8001:8000"  # Измените 8001 на нужный порт
```

### Проблемы с правами доступа

На Linux может потребоваться изменить права доступа к файлу базы данных:

```bash
sudo chmod 666 exams_g/backend/school.db
```

### Пересборка после изменений

После изменения кода необходимо пересобрать образы:

```bash
docker-compose build
docker-compose up -d
```

## Production настройки

Для production рекомендуется:

1. Использовать PostgreSQL вместо SQLite
2. Настроить SSL/TLS сертификаты
3. Использовать secrets для хранения паролей
4. Настроить резервное копирование базы данных
5. Использовать reverse proxy (например, Traefik или Nginx) перед контейнерами

## Мониторинг

Проверка статуса контейнеров:

```bash
docker-compose ps
```

Проверка здоровья сервисов:

```bash
docker-compose ps
# Статус healthcheck отображается в колонке STATUS
```

