import React, { createContext, useContext, useState, useCallback } from 'react';
import { useApi } from './useApi';

const GroupsContext = createContext();

export const GroupsProvider = ({ children }) => {
  const [groups, setGroups] = useState([]);
  const { makeRequest, loading, error } = useApi();

  const loadGroups = useCallback(async () => {
    try {
      const data = await makeRequest('GET', '/groups-with-students/');
      setGroups(data);
      return data;
    } catch (err) {
      console.error('Ошибка загрузки групп:', err);
      throw err;
    }
  }, [makeRequest]);

  const createGroup = useCallback(async (groupData) => {
    try {
      const newGroup = await makeRequest('POST', '/groups/', groupData);
      setGroups(prev => [...prev, newGroup]);
      return newGroup;
    } catch (err) {
      throw err;
    }
  }, [makeRequest]);

  const updateGroup = useCallback(async (id, groupData) => {
    try {
      const updatedGroup = await makeRequest('PUT', `/groups/${id}`, groupData);
      setGroups(prev => prev.map(g => g.id === id ? updatedGroup : g));
      return updatedGroup;
    } catch (err) {
      throw err;
    }
  }, [makeRequest]);

  const deleteGroup = useCallback(async (id) => {
    try {
      await makeRequest('DELETE', `/groups/${id}`);
      setGroups(prev => prev.filter(g => g.id !== id));
    } catch (err) {
      throw err;
    }
  }, [makeRequest]);

  const value = {
    groups,
    loading,
    error,
    loadGroups,
    createGroup,
    updateGroup,
    deleteGroup
  };

  return (
    <GroupsContext.Provider value={value}>
      {children}
    </GroupsContext.Provider>
  );
};

export const useGroups = () => {
  const context = useContext(GroupsContext);
  if (!context) {
    throw new Error('useGroups must be used within a GroupsProvider');
  }
  return context;
};