import React, { createContext, useContext, useState, useCallback } from 'react';
import { useApi } from './useApi';

const ExamsContext = createContext();

export const ExamsProvider = ({ children }) => {
  const [exams, setExams] = useState([]);
  const [selectedExam, setSelectedExam] = useState(null);
  const { makeRequest, loading, error } = useApi();

  const loadExams = useCallback(async () => {
    try {
      const data = await makeRequest('GET', '/exams/?limit=1000');
      setExams(data);
      return data;
    } catch (err) {
      console.error('Ошибка загрузки экзаменов:', err);
      throw err;
    }
  }, [makeRequest]);

  const createExam = useCallback(async (examData) => {
    try {
      const newExam = await makeRequest('POST', '/exams/', examData);
      setExams(prev => [...prev, newExam]);
      return newExam;
    } catch (err) {
      throw err;
    }
  }, [makeRequest]);

  const updateExam = useCallback(async (id, examData) => {
    try {
      const updatedExam = await makeRequest('PUT', `/exams/${id}`, examData);
      setExams(prev => prev.map(e => e.id === id ? updatedExam : e));
      return updatedExam;
    } catch (err) {
      throw err;
    }
  }, [makeRequest]);

  const deleteExam = useCallback(async (id) => {
    try {
      await makeRequest('DELETE', `/exams/${id}`);
      setExams(prev => prev.filter(e => e.id !== id));
    } catch (err) {
      throw err;
    }
  }, [makeRequest]);

  const value = {
    exams,
    selectedExam,
    loading,
    error,
    loadExams,
    createExam,
    updateExam,
    deleteExam,
    setSelectedExam
  };

  return (
    <ExamsContext.Provider value={value}>
      {children}
    </ExamsContext.Provider>
  );
};

export const useExams = () => {
  const context = useContext(ExamsContext);
  if (!context) {
    throw new Error('useExams must be used within an ExamsProvider');
  }
  return context;
};