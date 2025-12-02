import axios from 'axios';

const API_BASE = 'http://127.0.0.1:8000';

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