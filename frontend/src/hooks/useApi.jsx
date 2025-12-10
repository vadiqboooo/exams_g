// src/hooks/useApi.js
import { useState, useCallback } from 'react';
import axios from 'axios';

// Используем относительный путь для работы через nginx proxy в Docker
// В development используем локальный сервер
const API_BASE = import.meta.env.VITE_API_BASE_URL || 
                 (import.meta.env.DEV ? 'http://127.0.0.1:8000' : '');

export const useApi = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const makeRequest = useCallback(async (method, endpoint, data = null) => {
    setLoading(true);
    setError(null);
    
    try {
      // Получаем токен из localStorage
      const token = localStorage.getItem('token');
      
      const config = {
        method,
        url: `${API_BASE}${endpoint}`,
        headers: {
          'Content-Type': 'application/json; charset=utf-8'
        },
        ...(data && { data })
      };
      
      // Добавляем токен в заголовок Authorization, если он есть
      if (token) {
        config.headers['Authorization'] = `Bearer ${token}`;
      }
      
      const response = await axios(config);
      return response.data;
    } catch (err) {
      // Логируем детали ошибки для отладки
      console.error('API Request Error:', {
        method: method,
        url: `${API_BASE}${endpoint}`,
        data: data,
        status: err.response?.status,
        statusText: err.response?.statusText,
        responseData: err.response?.data,
        message: err.message,
        code: err.code
      });
      
      // Для ошибок валидации (422) показываем детали
      let errorMessage = err.response?.data?.detail || err.response?.data?.message || err.message || 'Ошибка соединения';
      
      // Если это ошибка валидации, пытаемся извлечь детали
      if (err.response?.status === 422 && err.response?.data?.detail) {
        if (Array.isArray(err.response.data.detail)) {
          // Pydantic validation errors
          const validationErrors = err.response.data.detail.map(e => 
            `${e.loc?.join('.')}: ${e.msg}`
          ).join('; ');
          errorMessage = `Ошибка валидации: ${validationErrors}`;
        } else if (typeof err.response.data.detail === 'string') {
          errorMessage = err.response.data.detail;
        }
      }
      
      console.error('API Error:', {
        status: err.response?.status,
        data: err.response?.data,
        message: errorMessage
      });
      
      setError(errorMessage);
      
      // Если ошибка аутентификации, очищаем токен и перенаправляем на страницу входа
      if (err.response?.status === 401) {
        localStorage.removeItem('token');
        localStorage.removeItem('role');
        localStorage.removeItem('teacher_name');
        // Не перенаправляем автоматически, чтобы компонент мог обработать ошибку
      }
      
      throw new Error(errorMessage);
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    loading,
    error,
    makeRequest,
    clearError: () => setError(null)
  };
};