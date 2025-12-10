import axios from 'axios';

// Используем относительный путь для работы через nginx proxy в Docker
// В development можно использовать полный URL
const API_BASE = import.meta.env.VITE_API_BASE_URL || '';

// Создаем экземпляр axios с базовыми настройками
const api = axios.create({
  baseURL: API_BASE,
  headers: {
    'Content-Type': 'application/json',
  },
});

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