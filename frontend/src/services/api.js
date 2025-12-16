import axios from 'axios';

// Используем относительный путь для работы через nginx proxy в Docker
// В development используем локальный сервер
const API_BASE = import.meta.env.VITE_API_BASE_URL || 
                 (import.meta.env.DEV ? 'http://127.0.0.1:8000' : '');

// Создаем экземпляр axios с базовыми настройками
const api = axios.create({
  baseURL: API_BASE,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Перехватчик для добавления токена авторизации
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Перехватчик для обработки ошибок
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const errorMessage = error.response?.data?.detail || 
                        error.response?.data?.message || 
                        error.message || 
                        'Ошибка соединения';
    
    return Promise.reject(new Error(errorMessage));
  }
);

export default api;