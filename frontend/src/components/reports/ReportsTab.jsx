import React, { useState, useEffect } from 'react';
import axios from 'axios';
import ReportForm from './ReportForm';
import './ReportsTab.css';

const API_BASE = import.meta.env.VITE_API_BASE_URL ||
                 (import.meta.env.DEV ? 'http://127.0.0.1:8000' : '');

export default function ReportsTab({ showNotification, userRole }) {
  const [reports, setReports] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const token = localStorage.getItem('token');
  const isOwner = userRole === 'owner' || userRole === 'admin';

  useEffect(() => {
    fetchReports();
  }, []);

  const fetchReports = async () => {
    setIsLoading(true);
    try {
      const response = await axios.get(`${API_BASE}/reports/`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setReports(response.data);
    } catch (error) {
      console.error('Ошибка загрузки отчетов:', error);
      showNotification('Ошибка загрузки отчетов', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateReport = async (reportData) => {
    try {
      await axios.post(`${API_BASE}/reports/`, reportData, {
        headers: { Authorization: `Bearer ${token}` }
      });
      showNotification('Отчет создан', 'success');
      setShowForm(false);
      fetchReports();
    } catch (error) {
      showNotification(error.response?.data?.detail || 'Ошибка создания отчета', 'error');
    }
  };

  const formatDate = (dateStr) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('ru-RU', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const formatDateTime = (isoString) => {
    const date = new Date(isoString);
    return date.toLocaleString('ru-RU', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="reports-container">
      <div className="reports-header">
        <h2>Отчеты</h2>
        <button onClick={() => setShowForm(true)} className="btn-create-report">
          + Создать отчет
        </button>
      </div>

      {isLoading ? (
        <p className="loading">Загрузка...</p>
      ) : reports.length === 0 ? (
        <p className="no-data">Нет отчетов</p>
      ) : (
        <div className="reports-grid">
          {reports.map(report => (
            <div key={report.id} className="report-card">
              <div className="report-card-header">
                <div className="report-date">{formatDate(report.report_date)}</div>
                {isOwner && (
                  <div className="report-author">{report.employee_name || '-'}</div>
                )}
              </div>

              <div className="report-content">
                <pre>{report.content}</pre>
              </div>

              <div className="report-footer">
                <span className="report-created">
                  Создано: {formatDateTime(report.created_at)}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <ReportForm
          onSubmit={handleCreateReport}
          onClose={() => setShowForm(false)}
        />
      )}
    </div>
  );
}
