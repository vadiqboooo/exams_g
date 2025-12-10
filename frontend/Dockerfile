# Стадия сборки
FROM node:20-alpine AS builder

WORKDIR /app

# Аргументы сборки
ARG VITE_API_BASE_URL=
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL

# НЕ устанавливаем NODE_ENV=production до сборки, чтобы установились devDependencies
# NODE_ENV будет установлен только для production стадии

# Установка дополнительных инструментов для отладки
RUN apk add --no-cache git

# Копирование файлов зависимостей
COPY package*.json ./

# Установка ВСЕХ зависимостей (включая devDependencies для сборки)
# NODE_ENV не установлен, поэтому npm установит все зависимости включая devDependencies
RUN npm ci || npm install

# Копирование исходного кода
COPY . .

# Отключение ESLint во время сборки
ENV ESLINT_NO_DEV_ERRORS=true
ENV DISABLE_ESLINT_PLUGIN=true

# Сборка приложения (NODE_ENV будет production только для оптимизации сборки)
RUN npm run build

# Стадия production
FROM nginx:alpine

# Копирование собранных файлов из стадии сборки
COPY --from=builder /app/dist /usr/share/nginx/html

# Копирование конфигурации nginx
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Открытие порта
EXPOSE 80

# Запуск nginx
CMD ["nginx", "-g", "daemon off;"]

