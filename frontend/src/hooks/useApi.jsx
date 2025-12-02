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
      const config = {
        method,
        url: `${API_BASE}${endpoint}`,
        ...(data && { data })
      };
      
      const response = await axios(config);
      return response.data;
    } catch (err) {
      const errorMessage = err.response?.data?.detail || err.response?.data?.message || err.message || 'Ошибка соединения';
      setError(errorMessage);
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