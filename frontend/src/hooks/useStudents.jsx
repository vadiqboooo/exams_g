import React, { createContext, useContext, useState, useCallback } from 'react';
import { useApi } from './useApi';

const StudentsContext = createContext();

export const StudentsProvider = ({ children }) => {
  const [students, setStudents] = useState([]);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const { makeRequest, loading, error } = useApi();

  const loadStudents = useCallback(async () => {
    try {
      const data = await makeRequest('GET', '/students/');
      setStudents(data);
      return data;
    } catch (err) {
      console.error('Ошибка загрузки студентов:', err);
    }
  }, [makeRequest]);

  const createStudent = useCallback(async (studentData) => {
    try {
      const newStudent = await makeRequest('POST', '/students/', studentData);
      setStudents(prev => [...prev, newStudent]);
      return newStudent;
    } catch (err) {
      throw err;
    }
  }, [makeRequest]);

  const updateStudent = useCallback(async (id, studentData) => {
    try {
      const updatedStudent = await makeRequest('PUT', `/students/${id}`, studentData);
      setStudents(prev => prev.map(s => s.id === id ? updatedStudent : s));
      return updatedStudent;
    } catch (err) {
      throw err;
    }
  }, [makeRequest]);

  const deleteStudent = useCallback(async (id) => {
    try {
      await makeRequest('DELETE', `/students/${id}`);
      setStudents(prev => prev.filter(s => s.id !== id));
    } catch (err) {
      throw err;
    }
  }, [makeRequest]);

  const value = {
    students,
    selectedStudent,
    loading,
    error,
    loadStudents,
    createStudent,
    updateStudent,
    deleteStudent,
    setSelectedStudent
  };

  return (
    <StudentsContext.Provider value={value}>
      {children}
    </StudentsContext.Provider>
  );
};

export const useStudents = () => {
  const context = useContext(StudentsContext);
  if (!context) {
    throw new Error('useStudents must be used within a StudentsProvider');
  }
  return context;
};