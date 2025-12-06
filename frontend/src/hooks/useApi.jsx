// src/hooks/useApi.js
import { useState, useCallback } from 'react';
import axios from 'axios';

const API_BASE = 'http://127.0.0.1:8000';

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
        headers: {},
        ...(data && { data })
      };
      
      // Добавляем токен в заголовок Authorization, если он есть
      if (token) {
        config.headers['Authorization'] = `Bearer ${token}`;
      }
      
      const response = await axios(config);
      return response.data;
    } catch (err) {
      const errorMessage = err.response?.data?.detail || err.response?.data?.message || err.message || 'Ошибка соединения';
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