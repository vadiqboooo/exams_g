import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import ReportForm from './ReportForm';
import TaskForm from '../tasks/TaskForm';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../ui/tabs';
import './ReportsTab.css';

const API_BASE = import.meta.env.VITE_API_BASE_URL ||
                 (import.meta.env.DEV ? 'http://127.0.0.1:8000' : '');

// Общие вспомогательные функции
const formatDateTime = (s) => {
  if (!s) return '—';
  return new Date(s).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
};
const getStatusLabel = (s) => ({ new: 'Новая', in_progress: 'В работе', completed: 'Выполнена', postponed: 'Перенесена' }[s] || s);
const getStatusClass = (s) => ({ new: 'status-new', in_progress: 'status-in-progress', completed: 'status-completed', postponed: 'status-postponed' }[s] || '');
const getDeadlineLabel = (t) => {
  const typeMap = { urgent: '🔴 Срочно', today: '🟡 Сегодня', tomorrow: '🟢 Завтра', custom: '📅' };
  if (typeMap[t.deadline_type]) return { label: typeMap[t.deadline_type], cls: t.deadline_type };
  if (t.deadline) return { label: formatDateTime(t.deadline), cls: 'custom' };
  return null;
};

export default function ReportsTab({ showNotification, userRole }) {
  const isOwner = userRole === 'owner' || userRole === 'admin';

  if (isOwner) {
    return <OwnerView showNotification={showNotification} />;
  }
  return <SchoolAdminView showNotification={showNotification} userRole={userRole} />;
}

// ============================================================
// OWNER VIEW
// ============================================================
function OwnerView({ showNotification }) {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [reports, setReports] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [editReport, setEditReport] = useState(null);
  const [viewTask, setViewTask] = useState(null);
  const [period, setPeriod] = useState('week');

  const token = localStorage.getItem('token');

  useEffect(() => {
    fetchAll();
  }, []);

  const fetchAll = async () => {
    setIsLoading(true);
    try {
      const [rRes, tRes] = await Promise.all([
        axios.get(`${API_BASE}/reports/`, { headers: { Authorization: `Bearer ${token}` } }),
        axios.get(`${API_BASE}/tasks/`, { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      setReports(rRes.data);
      setTasks(tRes.data);
    } catch (e) {
      showNotification('Ошибка загрузки данных', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateTask = async (taskData) => {
    try {
      await axios.post(`${API_BASE}/tasks/`, taskData, {
        headers: { Authorization: `Bearer ${token}` }
      });
      showNotification('Задача создана', 'success');
      setShowTaskForm(false);
      fetchAll();
    } catch (e) {
      showNotification(e.response?.data?.detail || 'Ошибка создания задачи', 'error');
    }
  };

  const handleUpdateStatus = async (taskId, newStatus) => {
    try {
      await axios.put(`${API_BASE}/tasks/${taskId}`, { status: newStatus }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      fetchAll();
    } catch (e) {
      showNotification('Ошибка обновления статуса', 'error');
    }
  };

  const handleUpdateReport = async (reportData) => {
    try {
      await axios.put(`${API_BASE}/reports/${editReport.id}`, reportData, {
        headers: { Authorization: `Bearer ${token}` }
      });
      showNotification('Отчет обновлен', 'success');
      setEditReport(null);
      fetchAll();
    } catch (e) {
      showNotification(e.response?.data?.detail || 'Ошибка обновления отчета', 'error');
    }
  };

  const handleDeleteReport = async (reportId) => {
    if (!window.confirm('Удалить этот отчет?')) return;
    try {
      await axios.delete(`${API_BASE}/reports/${reportId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      showNotification('Отчет удален', 'success');
      fetchAll();
    } catch (e) {
      showNotification('Ошибка удаления отчета', 'error');
    }
  };

  // Фильтрация по периоду
  const periodStart = useMemo(() => {
    const now = new Date();
    if (period === 'day') {
      const d = new Date(now);
      d.setHours(0, 0, 0, 0);
      return d;
    }
    if (period === 'week') {
      const d = new Date(now);
      d.setDate(d.getDate() - 6);
      d.setHours(0, 0, 0, 0);
      return d;
    }
    // month
    const d = new Date(now);
    d.setDate(d.getDate() - 29);
    d.setHours(0, 0, 0, 0);
    return d;
  }, [period]);

  const filteredReports = useMemo(() =>
    reports.filter(r => new Date(r.report_date) >= periodStart),
    [reports, periodStart]
  );

  const filteredTasks = useMemo(() =>
    tasks.filter(t => t.completed_at && new Date(t.completed_at) >= periodStart),
    [tasks, periodStart]
  );

  // Статистика по сотрудникам
  const employeeStats = useMemo(() => {
    const map = {};
    filteredReports.forEach(r => {
      const name = r.employee_name || '—';
      if (!map[name]) map[name] = { name, money: 0, reports: 0 };
      map[name].reports++;
      if (r.money) {
        map[name].money += (r.money.cash || 0) + (r.money.mobile_bank || 0) + (r.money.non_cash || 0);
      }
    });
    filteredTasks.forEach(t => {
      const name = t.assigned_to_name || '—';
      if (!map[name]) map[name] = { name, money: 0, reports: 0 };
      map[name].completedTasks = (map[name].completedTasks || 0) + 1;
    });
    return Object.values(map);
  }, [filteredReports, filteredTasks]);

  // Вода по школам — берём последний отчёт каждого сотрудника в периоде
  const waterByEmployee = useMemo(() => {
    const latestByEmployee = {};
    [...filteredReports].sort((a, b) => new Date(a.report_date) - new Date(b.report_date))
      .forEach(r => {
        if (r.water) latestByEmployee[r.employee_name || '—'] = r.water;
      });
    return Object.entries(latestByEmployee);
  }, [filteredReports]);

  // Список покупок из отчётов периода
  const suppliesList = useMemo(() =>
    filteredReports
      .filter(r => r.supplies_needed && r.supplies_needed.trim())
      .map(r => ({ employee: r.employee_name, date: r.report_date, text: r.supplies_needed })),
    [filteredReports]
  );

  const formatDate = (d) => new Date(d).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' });
  const formatMoney = (n) => n > 0 ? `${n.toLocaleString('ru-RU')} ₽` : '—';

  return (
    <div className="owner-reports">
      <div className="owner-reports-header">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="dashboard">Дашборд</TabsTrigger>
            <TabsTrigger value="tasks">Задачи</TabsTrigger>
            <TabsTrigger value="reports">Отчеты</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {isLoading ? (
        <p className="loading">Загрузка...</p>
      ) : (
        <>
          {/* ДАШБОРД */}
          {activeTab === 'dashboard' && (
            <div className="dashboard">
              <div className="period-bar">
                {[['day', 'Сегодня'], ['week', 'Неделя'], ['month', 'Месяц']].map(([key, label]) => (
                  <button
                    key={key}
                    className={`period-btn ${period === key ? 'active' : ''}`}
                    onClick={() => setPeriod(key)}
                  >{label}</button>
                ))}
              </div>

              <div className="dashboard-grid">
                {/* Статистика по сотрудникам */}
                <div className="dash-card dash-card-wide">
                  <h3 className="dash-card-title">📊 Статистика сотрудников</h3>
                  {employeeStats.length === 0 ? (
                    <p className="dash-empty">Нет данных за период</p>
                  ) : (
                    <table className="dash-table">
                      <thead>
                        <tr>
                          <th>Сотрудник</th>
                          <th>Задач выполнено</th>
                          <th>Отчётов</th>
                          <th>Денег получено</th>
                        </tr>
                      </thead>
                      <tbody>
                        {employeeStats.map(e => (
                          <tr key={e.name}>
                            <td>{e.name}</td>
                            <td className="num">{e.completedTasks || 0}</td>
                            <td className="num">{e.reports}</td>
                            <td className="money">{formatMoney(e.money)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>

                {/* Вода */}
                <div className="dash-card">
                  <h3 className="dash-card-title">💧 Остаток воды</h3>
                  {waterByEmployee.length === 0 ? (
                    <p className="dash-empty">Нет данных</p>
                  ) : (
                    <ul className="dash-list">
                      {waterByEmployee.map(([name, water]) => (
                        <li key={name}>
                          <span className="dash-list-label">{name}</span>
                          <span className="dash-list-value">{water}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                {/* Список покупок */}
                <div className="dash-card">
                  <h3 className="dash-card-title">🛒 Список покупок</h3>
                  {suppliesList.length === 0 ? (
                    <p className="dash-empty">Нет данных</p>
                  ) : (
                    <ul className="dash-list">
                      {suppliesList.map((s, i) => (
                        <li key={i}>
                          <span className="dash-list-label">{s.employee} <span className="dash-date">{formatDate(s.date)}</span></span>
                          <span className="dash-list-value">{s.text}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ЗАДАЧИ */}
          {activeTab === 'tasks' && (
            <TasksSection
              tasks={tasks}
              onCreateTask={() => setShowTaskForm(true)}
              onUpdateStatus={handleUpdateStatus}
              onViewTask={setViewTask}
              getStatusLabel={getStatusLabel}
              getStatusClass={getStatusClass}
              getDeadlineLabel={getDeadlineLabel}
            />
          )}

          {/* ОТЧЕТЫ */}
          {activeTab === 'reports' && (
            <div className="owner-section">
              <h2>Отчеты сотрудников</h2>
              {reports.length === 0 ? (
                <p className="no-data">Нет отчетов</p>
              ) : (
                <ReportsTable
                  reports={reports}
                  isOwner
                  onEdit={setEditReport}
                  onDelete={handleDeleteReport}
                />
              )}
            </div>
          )}
        </>
      )}

      {showTaskForm && (
        <TaskForm onSubmit={handleCreateTask} onClose={() => setShowTaskForm(false)} />
      )}

      {viewTask && (
        <TaskDetailModal
          task={viewTask}
          onClose={() => setViewTask(null)}
          onStatusChange={(id, s) => { handleUpdateStatus(id, s); setViewTask(t => ({ ...t, status: s })); }}
          getStatusLabel={getStatusLabel}
          getStatusClass={getStatusClass}
          getDeadlineLabel={getDeadlineLabel}
          formatDateTime={formatDateTime}
        />
      )}

      {editReport && (
        <ReportEditModal
          report={editReport}
          onSave={handleUpdateReport}
          onClose={() => setEditReport(null)}
        />
      )}
    </div>
  );
}

// ============================================================
// TASKS SECTION
// ============================================================
function TasksSection({ tasks, onCreateTask, onUpdateStatus, onViewTask, getStatusLabel, getStatusClass, getDeadlineLabel }) {
  const STATUS_OPTIONS = [
    { value: 'new', label: 'Новая' },
    { value: 'in_progress', label: 'В работе' },
    { value: 'completed', label: 'Выполнена' },
    { value: 'postponed', label: 'Перенесена на завтра' },
  ];

  return (
    <div className="owner-section">
      <div className="section-header">
        <h2>Задачи</h2>
        <button onClick={onCreateTask} className="btn-create">+ Создать задачу</button>
      </div>
      {tasks.length === 0 ? (
        <p className="no-data">Нет задач</p>
      ) : (
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Задача</th>
                <th>Исполнитель</th>
                <th>Дедлайн</th>
                <th>Статус</th>
              </tr>
            </thead>
            <tbody>
              {tasks.map(t => {
                const dl = getDeadlineLabel(t);
                return (
                  <tr key={t.id}>
                    <td>
                      <button className="task-link" onClick={() => onViewTask(t)}>
                        {t.title}
                      </button>
                      {t.description && <div className="task-desc">{t.description}</div>}
                    </td>
                    <td>{t.assigned_to_name || '—'}</td>
                    <td>
                      {dl
                        ? <span className={`deadline-badge ${dl.cls}`}>{dl.label}</span>
                        : <span className="text-muted">—</span>
                      }
                    </td>
                    <td>
                      <select
                        className={`status-select ${getStatusClass(t.status)}`}
                        value={t.status}
                        onChange={(e) => onUpdateStatus(t.id, e.target.value)}
                      >
                        {STATUS_OPTIONS.map(o => (
                          <option key={o.value} value={o.value}>{o.label}</option>
                        ))}
                      </select>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ============================================================
// TASK DETAIL MODAL
// ============================================================
function TaskDetailModal({ task, onClose, onStatusChange, getStatusLabel, getStatusClass, getDeadlineLabel, formatDateTime }) {
  const STATUS_OPTIONS = [
    { value: 'new', label: 'Новая' },
    { value: 'in_progress', label: 'В работе' },
    { value: 'completed', label: 'Выполнена' },
    { value: 'postponed', label: 'Перенесена на завтра' },
  ];

  const dl = getDeadlineLabel(task);

  return (
    <div className="task-dialog-overlay" onClick={onClose}>
      <div className="task-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="task-dialog-header">
          <h2 className="task-dialog-title">{task.title}</h2>
          <button type="button" onClick={onClose} className="btn-icon-close">✕</button>
        </div>
        <div className="task-detail-body">
          {task.description && (
            <p className="task-detail-desc">{task.description}</p>
          )}
          <div className="task-detail-grid">
            <div className="task-detail-item">
              <span className="task-detail-label">Исполнитель</span>
              <span>{task.assigned_to_name || '—'}</span>
            </div>
            <div className="task-detail-item">
              <span className="task-detail-label">Создал</span>
              <span>{task.created_by_name || '—'}</span>
            </div>
            <div className="task-detail-item">
              <span className="task-detail-label">Дедлайн</span>
              <span>{dl ? <span className={`deadline-badge ${dl.cls}`}>{dl.label}</span> : '—'}</span>
            </div>
            {task.deadline && (
              <div className="task-detail-item">
                <span className="task-detail-label">Время</span>
                <span>{formatDateTime(task.deadline)}</span>
              </div>
            )}
            <div className="task-detail-item">
              <span className="task-detail-label">Создана</span>
              <span>{formatDateTime(task.created_at)}</span>
            </div>
            {task.completed_at && (
              <div className="task-detail-item">
                <span className="task-detail-label">Выполнена</span>
                <span>{formatDateTime(task.completed_at)}</span>
              </div>
            )}
          </div>

          {task.linked_students && task.linked_students.length > 0 && (
            <div className="task-detail-section">
              <span className="task-detail-label">Студенты</span>
              <div className="task-detail-students">
                {task.linked_students.map(s => (
                  <div key={s.id} className="task-student-row">
                    <span>{s.fio}</span>
                    {s.phone && <a href={`tel:${s.phone}`} className="task-student-phone">{s.phone}</a>}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="task-detail-status">
            <span className="task-detail-label">Статус</span>
            <select
              className={`status-select ${getStatusClass(task.status)}`}
              value={task.status}
              onChange={(e) => onStatusChange(task.id, e.target.value)}
            >
              {STATUS_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// REPORT EDIT MODAL
// ============================================================
function ReportEditModal({ report, onSave, onClose }) {
  const [form, setForm] = useState({
    report_date: report.report_date || '',
    leads_calls: report.leads?.calls || 0,
    leads_social: report.leads?.social || 0,
    leads_website: report.leads?.website || 0,
    trial_scheduled: report.trial_scheduled || 0,
    trial_attended: report.trial_attended || 0,
    notified_tomorrow: report.notified_tomorrow || '',
    cancellations: report.cancellations || '',
    churn: report.churn || '',
    money_cash: report.money?.cash || 0,
    money_mobile: report.money?.mobile_bank || 0,
    money_non_cash: report.money?.non_cash || 0,
    water: report.water || '',
    supplies_needed: report.supplies_needed || '',
    comments: report.comments || '',
  });
  const [isSaving, setIsSaving] = useState(false);

  const set = (key) => (e) => setForm(f => ({ ...f, [key]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    await onSave({
      report_date: form.report_date,
      leads: { calls: +form.leads_calls, social: +form.leads_social, website: +form.leads_website },
      trial_scheduled: +form.trial_scheduled,
      trial_attended: +form.trial_attended,
      notified_tomorrow: form.notified_tomorrow,
      cancellations: form.cancellations,
      churn: form.churn,
      money: { cash: +form.money_cash, mobile_bank: +form.money_mobile, non_cash: +form.money_non_cash },
      water: form.water,
      supplies_needed: form.supplies_needed,
      comments: form.comments,
    });
    setIsSaving(false);
  };

  return (
    <div className="task-dialog-overlay" onClick={onClose}>
      <div className="task-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="task-dialog-header">
          <h2 className="task-dialog-title">Редактировать отчет</h2>
          <button type="button" onClick={onClose} className="btn-icon-close">✕</button>
        </div>
        <form onSubmit={handleSubmit} className="report-edit-form">
          <div className="re-row">
            <label>Дата</label>
            <input type="date" value={form.report_date} onChange={set('report_date')} />
          </div>
          <fieldset className="re-fieldset">
            <legend>Лиды</legend>
            <div className="re-group">
              <div><label>Звонки</label><input type="number" min="0" value={form.leads_calls} onChange={set('leads_calls')} /></div>
              <div><label>Соц.сети</label><input type="number" min="0" value={form.leads_social} onChange={set('leads_social')} /></div>
              <div><label>Сайт</label><input type="number" min="0" value={form.leads_website} onChange={set('leads_website')} /></div>
            </div>
          </fieldset>
          <fieldset className="re-fieldset">
            <legend>Пробные</legend>
            <div className="re-group">
              <div><label>Записано</label><input type="number" min="0" value={form.trial_scheduled} onChange={set('trial_scheduled')} /></div>
              <div><label>Пришло</label><input type="number" min="0" value={form.trial_attended} onChange={set('trial_attended')} /></div>
            </div>
            <div className="re-row"><label>Оповестили</label><input value={form.notified_tomorrow} onChange={set('notified_tomorrow')} /></div>
          </fieldset>
          <fieldset className="re-fieldset">
            <legend>Деньги</legend>
            <div className="re-group">
              <div><label>Нал</label><input type="number" min="0" value={form.money_cash} onChange={set('money_cash')} /></div>
              <div><label>Моб</label><input type="number" min="0" value={form.money_mobile} onChange={set('money_mobile')} /></div>
              <div><label>Безнал</label><input type="number" min="0" value={form.money_non_cash} onChange={set('money_non_cash')} /></div>
            </div>
          </fieldset>
          <div className="re-row"><label>Переносы</label><input value={form.cancellations} onChange={set('cancellations')} /></div>
          <div className="re-row"><label>Отток</label><input value={form.churn} onChange={set('churn')} /></div>
          <div className="re-row"><label>Вода</label><input value={form.water} onChange={set('water')} /></div>
          <div className="re-row"><label>Покупки</label><input value={form.supplies_needed} onChange={set('supplies_needed')} /></div>
          <div className="re-row"><label>Комментарии</label><textarea rows={2} value={form.comments} onChange={set('comments')} /></div>
          <div className="task-dialog-footer">
            <button type="button" className="btn-outline" onClick={onClose}>Отмена</button>
            <button type="submit" className="btn-primary" disabled={isSaving}>{isSaving ? 'Сохранение...' : 'Сохранить'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ============================================================
// REPORTS TABLE (переиспользуемый)
// ============================================================
function ReportsTable({ reports, isOwner, onEdit, onDelete }) {
  const [expandedId, setExpandedId] = useState(null);

  const formatDate = (d) => new Date(d).toLocaleDateString('ru-RU', { year: 'numeric', month: 'long', day: 'numeric' });
  const formatTime = (s) => s ? new Date(s).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }) : '—';
  const formatDuration = (s, e) => {
    if (!s || !e) return '—';
    const m = Math.floor((new Date(e) - new Date(s)) / 60000);
    if (m <= 0) return '—';
    const h = Math.floor(m / 60);
    return h > 0 ? `${h}ч ${m % 60}м` : `${m}м`;
  };

  return (
    <div className="table-container">
      <table className="reports-table">
        <thead>
          <tr>
            <th>Дата</th>
            {isOwner && <th>Сотрудник</th>}
            <th>Лиды</th>
            <th>Пробные</th>
            <th>Деньги</th>
            <th>Продолжительность</th>
            <th>Задачи</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {reports.map(r => {
            const leads = r.leads ? (r.leads.calls || 0) + (r.leads.social || 0) + (r.leads.website || 0) : 0;
            const money = r.money ? (r.money.cash || 0) + (r.money.mobile_bank || 0) + (r.money.non_cash || 0) : 0;
            const isOnline = !r.work_end_time;
            const exp = expandedId === r.id;
            return (
              <React.Fragment key={r.id}>
                <tr className={`${exp ? 'expanded' : ''} ${isOnline ? 'row-online' : ''}`}>
                  <td className="report-date-cell">{formatDate(r.report_date)}</td>
                  {isOwner && <td>{r.employee_name || '—'}</td>}
                  <td className="number-cell">{leads || '—'}</td>
                  <td className="number-cell">{r.trial_attended > 0 ? `${r.trial_attended}/${r.trial_scheduled || 0}` : '—'}</td>
                  <td className="money-cell">{money > 0 ? `${money} ₽` : '—'}</td>
                  <td className="duration-cell">
                    {isOnline
                      ? <span className="online-badge">🟢 Онлайн</span>
                      : formatDuration(r.work_start_time, r.work_end_time)
                    }
                  </td>
                  <td className="number-cell">
                    {r.task_count > 0
                      ? <span className={isOnline ? 'task-count-active' : 'task-count-done'}>{r.task_count}</span>
                      : '—'
                    }
                  </td>
                  <td className="action-cell">
                    {isOwner && onEdit && (
                      <>
                        <button className="btn-icon" title="Редактировать" onClick={() => onEdit(r)}>✏️</button>
                        <button className="btn-icon btn-icon-danger" title="Удалить" onClick={() => onDelete(r.id)}>🗑️</button>
                      </>
                    )}
                    <button className="btn-expand" onClick={() => setExpandedId(exp ? null : r.id)}>
                      {exp ? '▲' : '▼'}
                    </button>
                  </td>
                </tr>
                {exp && (
                  <tr className="details-row">
                    <td colSpan={isOwner ? 8 : 7}>
                      <div className="report-details">
                        {(r.work_start_time || r.work_end_time) && (
                          <div className="detail-section detail-worktime">
                            <span>🕐 Начало: <strong>{formatTime(r.work_start_time)}</strong></span>
                            <span className="worktime-sep">→</span>
                            <span>Завершение: <strong>{formatTime(r.work_end_time)}</strong></span>
                          </div>
                        )}
                        {r.leads && (r.leads.calls > 0 || r.leads.social > 0 || r.leads.website > 0) && (
                          <div className="detail-section">
                            <strong>Лиды:</strong>
                            {r.leads.calls > 0 && <span> Звонки: {r.leads.calls}</span>}
                            {r.leads.social > 0 && <span> | Соц.сети: {r.leads.social}</span>}
                            {r.leads.website > 0 && <span> | Сайт: {r.leads.website}</span>}
                          </div>
                        )}
                        {(r.trial_scheduled > 0 || r.trial_attended > 0) && (
                          <div className="detail-section">
                            <strong>Пробные:</strong> Записано: {r.trial_scheduled}, Пришло: {r.trial_attended}
                            {r.notified_tomorrow && <span> | Оповестили: {r.notified_tomorrow}</span>}
                          </div>
                        )}
                        {r.money && (r.money.cash > 0 || r.money.mobile_bank > 0 || r.money.non_cash > 0) && (
                          <div className="detail-section">
                            <strong>Деньги:</strong>
                            {r.money.cash > 0 && <span> Нал: {r.money.cash}₽</span>}
                            {r.money.mobile_bank > 0 && <span> | Моб: {r.money.mobile_bank}₽</span>}
                            {r.money.non_cash > 0 && <span> | Безнал: {r.money.non_cash}₽</span>}
                          </div>
                        )}
                        {r.cancellations && <div className="detail-section"><strong>Переносы:</strong> {r.cancellations}</div>}
                        {r.churn && <div className="detail-section"><strong>Отток:</strong> {r.churn}</div>}
                        {r.water && <div className="detail-section"><strong>Вода:</strong> {r.water}</div>}
                        {r.supplies_needed && <div className="detail-section"><strong>Покупки:</strong> {r.supplies_needed}</div>}
                        {r.comments && <div className="detail-section"><strong>Комментарии:</strong> {r.comments}</div>}
                      </div>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ============================================================
// SCHOOL ADMIN VIEW
// ============================================================
function SchoolAdminView({ showNotification, userRole }) {
  const [reports, setReports] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [workStartTime, setWorkStartTime] = useState(null);
  const [activeReportId, setActiveReportId] = useState(null);
  const [viewMode, setViewMode] = useState('table');
  const [animationClass, setAnimationClass] = useState('');

  const token = localStorage.getItem('token');
  const userId = localStorage.getItem('employee_id') || localStorage.getItem('teacher_name') || 'default';
  const lsKey = (n) => `${n}_${userId}`;

  useEffect(() => {
    const savedTime = localStorage.getItem(lsKey('workStartTime'));
    const savedId = localStorage.getItem(lsKey('reportId'));
    if (savedTime && savedId) {
      setWorkStartTime(savedTime);
      setActiveReportId(parseInt(savedId));
      setViewMode('form');
    }
  }, []);

  useEffect(() => { fetchReports(); }, []);

  const fetchReports = async () => {
    setIsLoading(true);
    try {
      const res = await axios.get(`${API_BASE}/reports/`, { headers: { Authorization: `Bearer ${token}` } });
      setReports(res.data);
    } catch (e) {
      showNotification('Ошибка загрузки отчетов', 'error');
    } finally { setIsLoading(false); }
  };

  const startWork = async () => {
    try {
      const res = await axios.post(`${API_BASE}/reports/start`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const report = res.data;
      localStorage.setItem(lsKey('workStartTime'), report.work_start_time);
      localStorage.setItem(lsKey('reportId'), String(report.id));
      setWorkStartTime(report.work_start_time);
      setActiveReportId(report.id);
      setViewMode('form');
      setAnimationClass('slide-in-from-right');
      showNotification('Рабочий день начат', 'success');
      fetchReports();
    } catch (e) {
      showNotification(e.response?.data?.detail || 'Ошибка начала работы', 'error');
    }
  };

  const endWork = () => {
    ['workStartTime', 'reportFormData', 'savedReportTabs', 'lastSavedFormData', 'reportId'].forEach(k => localStorage.removeItem(lsKey(k)));
    setWorkStartTime(null);
    setActiveReportId(null);
    setViewMode('table');
    setAnimationClass('slide-in-from-left');
  };

  const handleCreateReport = async (reportData) => {
    try {
      await axios.put(`${API_BASE}/reports/${activeReportId}`, reportData, {
        headers: { Authorization: `Bearer ${token}` }
      });
      showNotification('Отчет сохранён, рабочий день завершён', 'success');
      endWork();
      fetchReports();
    } catch (e) {
      showNotification(e.response?.data?.detail || 'Ошибка сохранения отчета', 'error');
    }
  };

  return (
    <div className="reports-container">
      {viewMode === 'table' ? (
        <div className={`animated-content ${animationClass}`}>
          <div className="reports-header">
            <h2>Отчеты</h2>
            <div className="reports-header-actions">
              {workStartTime ? (
                <button onClick={() => { setViewMode('form'); setAnimationClass('slide-in-from-right'); }} className="btn-back-to-work">
                  ← Вернуться к отчету
                </button>
              ) : (
                <button onClick={startWork} className="btn-create-report">Начать рабочий день</button>
              )}
            </div>
          </div>
          {isLoading ? <p className="loading">Загрузка...</p> : reports.length === 0 ? <p className="no-data">Нет отчетов</p> : (
            <ReportsTable reports={reports} isOwner={false} />
          )}
        </div>
      ) : (
        <div className={`animated-content ${animationClass}`}>
          <ReportForm
            onSubmit={handleCreateReport}
            onClose={endWork}
            onBackToTable={() => { setViewMode('table'); setAnimationClass('slide-in-from-left'); }}
            userRole={userRole}
            showNotification={showNotification}
            workStartTime={workStartTime}
          />
        </div>
      )}
    </div>
  );
}
