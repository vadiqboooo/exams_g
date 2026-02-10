import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { RadioGroup, RadioGroupItem } from '../ui/radio-group';
import { Button } from '../ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../ui/tabs';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../ui/table';
import TaskForm from '../tasks/TaskForm';
import './ReportForm.css';

const API_BASE = import.meta.env.VITE_API_BASE_URL ||
                 (import.meta.env.DEV ? 'http://127.0.0.1:8000' : '');

export default function ReportForm({ onSubmit, onClose, onBackToTable, userRole, showNotification, workStartTime }) {
  const token = localStorage.getItem('token');
  const userId = localStorage.getItem('employee_id') || localStorage.getItem('teacher_name') || 'default';
  const lsKey = (name) => `${name}_${userId}`;
  const isOwner = userRole === 'owner' || userRole === 'admin' || userRole === 'school_admin';

  const [isLoading, setIsLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [tasks, setTasks] = useState([]);
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [viewTask, setViewTask] = useState(null);
  const [isLoadingTasks, setIsLoadingTasks] = useState(false);
  const [activeTab, setActiveTab] = useState('operations');
  const [savedTabs, setSavedTabs] = useState(() => {
    const saved = localStorage.getItem(lsKey('savedReportTabs'));
    return saved ? JSON.parse(saved) : [];
  });
  const [lastSavedFormData, setLastSavedFormData] = useState(() => {
    const saved = localStorage.getItem(lsKey('lastSavedFormData'));
    return saved ? JSON.parse(saved) : null;
  });

  const getInitialFormData = () => {
    const savedData = localStorage.getItem(lsKey('reportFormData'));
    if (savedData) {
      try {
        return JSON.parse(savedData);
      } catch (e) {
        console.error('Ошибка восстановления данных формы:', e);
      }
    }

    // Возвращаем данные по умолчанию
    return {
      report_date: new Date().toISOString().split('T')[0],
      leads: {
        calls: 0,
        social: 0,
        website: 0,
      },
      trialScheduled: 0,
      trialAttended: 0,
      notifiedTomorrow: 'да',
      cancellations: '',
      churn: '',
      money: {
        cash: 0,
        mobileBank: 0,
        nonCash: 0,
      },
      water: '',
      supplies: '',
      comments: '',
    };
  };

  const [formData, setFormData] = useState(getInitialFormData);

  // Сохраняем данные формы в localStorage при каждом изменении
  useEffect(() => {
    if (workStartTime) {
      localStorage.setItem(lsKey('reportFormData'), JSON.stringify(formData));
    }
  }, [formData, workStartTime]);

  // Сохраняем информацию о сохраненных вкладках
  useEffect(() => {
    localStorage.setItem(lsKey('savedReportTabs'), JSON.stringify(savedTabs));
  }, [savedTabs]);

  // Сохраняем lastSavedFormData в localStorage
  useEffect(() => {
    if (lastSavedFormData) {
      localStorage.setItem(lsKey('lastSavedFormData'), JSON.stringify(lastSavedFormData));
    }
  }, [lastSavedFormData]);

  // Отслеживаем изменения в данных формы и убираем зеленую отметку
  useEffect(() => {
    if (!lastSavedFormData || savedTabs.length === 0) return;

    // Определяем, какие поля относятся к каждой вкладке
    const tabFields = {
      'operations': ['leads', 'trialScheduled', 'trialAttended', 'notifiedTomorrow', 'cancellations', 'churn'],
      'finance': ['money', 'water', 'supplies', 'comments']
    };

    // Проверяем каждую сохраненную вкладку
    const tabsToRemove = [];

    savedTabs.forEach(tab => {
      const fields = tabFields[tab] || [];

      for (const field of fields) {
        const currentValue = JSON.stringify(formData[field]);
        const savedValue = JSON.stringify(lastSavedFormData[field]);

        if (currentValue !== savedValue) {
          tabsToRemove.push(tab);
          break;
        }
      }
    });

    // Убираем измененные вкладки из списка сохраненных
    if (tabsToRemove.length > 0) {
      setSavedTabs(prev => prev.filter(tab => !tabsToRemove.includes(tab)));
    }
  }, [formData, lastSavedFormData, savedTabs]);

  useEffect(() => {
    fetchTasks(formData.report_date);
  }, [formData.report_date]);

  const fetchTasks = async (reportDate) => {
    setIsLoadingTasks(true);
    try {
      const date = reportDate || formData.report_date;
      const response = await axios.get(`${API_BASE}/tasks/`, {
        headers: { Authorization: `Bearer ${token}` },
        params: { report_date: date }
      });
      setTasks(response.data);
    } catch (error) {
      console.error('Ошибка загрузки задач:', error);
      if (showNotification) {
        showNotification('Ошибка загрузки задач', 'error');
      }
    } finally {
      setIsLoadingTasks(false);
    }
  };

  const handleCreateTask = async (taskData) => {
    try {
      await axios.post(`${API_BASE}/tasks/`, taskData, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (showNotification) {
        showNotification('Задача создана', 'success');
      }
      setShowTaskForm(false);
      fetchTasks(formData.report_date);
    } catch (error) {
      if (showNotification) {
        showNotification(error.response?.data?.detail || 'Ошибка создания задачи', 'error');
      }
    }
  };

  const handleUpdateStatus = async (taskId, newStatus) => {
    try {
      await axios.put(`${API_BASE}/tasks/${taskId}`, { status: newStatus }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (showNotification) {
        showNotification('Статус обновлен', 'success');
      }
      fetchTasks(formData.report_date);
    } catch (error) {
      if (showNotification) {
        showNotification(error.response?.data?.detail || 'Ошибка обновления статуса', 'error');
      }
    }
  };

  const getStatusBadgeClass = (s) => ({
    new: 'status-new', in_progress: 'status-in-progress',
    completed: 'status-completed', postponed: 'status-postponed'
  }[s] || '');

  const getStatusLabel = (s) => ({
    new: 'Новая', in_progress: 'В работе',
    completed: 'Выполнена', postponed: 'Перенесена'
  }[s] || s);

  const getDeadlineBadge = (task) => {
    const map = { urgent: ['🔴 Срочно', 'urgent'], today: ['🟡 Сегодня', 'today'], tomorrow: ['🟢 Завтра', 'tomorrow'] };
    if (map[task.deadline_type]) return map[task.deadline_type];
    if (task.deadline) return [new Date(task.deadline).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }), 'custom'];
    return null;
  };

  const handleSave = () => {
    // Сохраняем текущее состояние формы
    setLastSavedFormData(JSON.parse(JSON.stringify(formData)));

    // Добавляем текущую вкладку в список сохраненных
    if (!savedTabs.includes(activeTab)) {
      setSavedTabs([...savedTabs, activeTab]);
    }

    // Показываем уведомление
    if (showNotification) {
      showNotification('Данные сохранены', 'success');
    }
  };

  const handleSubmit = async (e) => {
    if (e) e.preventDefault();
    setIsLoading(true);
    setSuccessMessage('');

    try {
      await onSubmit({
        report_date: formData.report_date,
        work_start_time: workStartTime || null,
        work_end_time: new Date().toISOString(),
        leads: {
          calls: parseInt(formData.leads.calls) || 0,
          social: parseInt(formData.leads.social) || 0,
          website: parseInt(formData.leads.website) || 0,
        },
        trial_scheduled: parseInt(formData.trialScheduled) || 0,
        trial_attended: parseInt(formData.trialAttended) || 0,
        notified_tomorrow: formData.notifiedTomorrow,
        cancellations: formData.cancellations,
        churn: formData.churn,
        money: {
          cash: parseInt(formData.money.cash) || 0,
          mobile_bank: parseInt(formData.money.mobileBank) || 0,
          non_cash: parseInt(formData.money.nonCash) || 0,
        },
        water: formData.water,
        supplies_needed: formData.supplies,
        comments: formData.comments,
      });

      setSuccessMessage('Отчет успешно отправлен');

      // Очистить форму и localStorage
      const clearedData = {
        report_date: new Date().toISOString().split('T')[0],
        leads: { calls: 0, social: 0, website: 0 },
        trialScheduled: 0,
        trialAttended: 0,
        notifiedTomorrow: 'да',
        cancellations: '',
        churn: '',
        money: { cash: 0, mobileBank: 0, nonCash: 0 },
        water: '',
        supplies: '',
        comments: '',
      };
      setFormData(clearedData);
      localStorage.removeItem(lsKey('reportFormData'));
      localStorage.removeItem(lsKey('savedReportTabs'));
      localStorage.removeItem(lsKey('lastSavedFormData'));
      setSavedTabs([]);
      setLastSavedFormData(null);

      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (error) {
      console.error('Ошибка при отправке отчета:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="report-form-wrapper">
      <div className="reports-header">
        <div className="form-header-flex">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onBackToTable}
            className="h-8 w-8 p-0"
          >
            <span className="arrow-left">←</span>
          </Button>
          <h2>Ежедневный отчет</h2>
          {workStartTime && (
            <span className="work-start-info">
              Начало: {new Date(workStartTime).toLocaleTimeString('ru-RU', {
                hour: '2-digit',
                minute: '2-digit'
              })}
            </span>
          )}
        </div>
        <div className="header-actions">
          <div className="header-date">
            <Label htmlFor="report_date" className="font-medium">
              Дата:
            </Label>
            <Input
              id="report_date"
              type="date"
              className="h-9"
              value={formData.report_date}
              onChange={(e) =>
                setFormData({ ...formData, report_date: e.target.value })
              }
              required
            />
          </div>
          <Button type="button" onClick={handleSubmit} disabled={isLoading} className="submit-button-header">
            {isLoading ? 'Завершение...' : 'Завершить рабочий день'}
          </Button>
        </div>
      </div>

      {/* Сообщение об успехе */}
      {successMessage && (
        <div className="success-message">{successMessage}</div>
      )}

      <form onSubmit={handleSubmit} className="report-form-content">
        <div className="form-layout">
          {/* Левая часть - Таблица с задачами */}
          <div className="tasks-section">
            <div className="tasks-header">
              <h3>Задачи</h3>
              {isOwner && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowTaskForm(true)}
                >
                  + Добавить задачу
                </Button>
              )}
            </div>
            <div className="tasks-table-wrapper">
              {isLoadingTasks ? (
                <p className="loading-tasks">Загрузка задач...</p>
              ) : tasks.length === 0 ? (
                <p className="no-tasks">Нет задач</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Задача</TableHead>
                      <TableHead>Дедлайн</TableHead>
                      <TableHead>Статус</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {tasks.map((task) => {
                      const dl = getDeadlineBadge(task);
                      return (
                        <TableRow key={task.id}>
                          <TableCell>
                            <button type="button" className="task-title-btn" onClick={() => setViewTask(task)}>
                              {task.title}
                            </button>
                            {task.description && (
                              <div className="task-description-small">{task.description}</div>
                            )}
                          </TableCell>
                          <TableCell>
                            {dl
                              ? <span className={`deadline-badge ${dl[1]}`}>{dl[0]}</span>
                              : <span className="text-muted-small">—</span>
                            }
                          </TableCell>
                          <TableCell>
                            <select
                              className={`status-select-compact ${getStatusBadgeClass(task.status)}`}
                              value={task.status}
                              onChange={(e) => handleUpdateStatus(task.id, e.target.value)}
                            >
                              <option value="new">Новая</option>
                              <option value="in_progress">В работе</option>
                              <option value="completed">Выполнена</option>
                              <option value="postponed">Перенесена на завтра</option>
                            </select>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </div>
          </div>

          {/* Правая часть - Табы с формой */}
          <div className="form-section">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="form-tabs">
              <TabsList>
                <TabsTrigger
                  value="operations"
                  className={savedTabs.includes('operations') ? 'saved' : ''}
                >
                  Операции и клиенты
                </TabsTrigger>
                <TabsTrigger
                  value="finance"
                  className={savedTabs.includes('finance') ? 'saved' : ''}
                >
                  Финансы и закупки
                </TabsTrigger>
              </TabsList>

              <TabsContent value="operations">
                <div className="tab-content-wrapper">
                  {/* Лиды */}
                  <div className="space-y-2">
                    <Label className="font-medium">Лиды (внести в CRM)</Label>
                    <div className="grid-cols-3">
                      <div className="space-y-1">
                        <Label htmlFor="calls" className="text-sm text-muted-foreground">
                          Звонки
                        </Label>
                        <Input
                          id="calls"
                          type="number"
                          min="0"
                          className="h-9"
                          value={formData.leads.calls}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              leads: { ...formData.leads, calls: e.target.value },
                            })
                          }
                        />
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor="social" className="text-sm text-muted-foreground">
                          Соц.сети
                        </Label>
                        <Input
                          id="social"
                          type="number"
                          min="0"
                          className="h-9"
                          value={formData.leads.social}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              leads: { ...formData.leads, social: e.target.value },
                            })
                          }
                        />
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor="website" className="text-sm text-muted-foreground">
                          Сайт
                        </Label>
                        <Input
                          id="website"
                          type="number"
                          min="0"
                          className="h-9"
                          value={formData.leads.website}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              leads: { ...formData.leads, website: e.target.value },
                            })
                          }
                        />
                      </div>
                    </div>
                  </div>

                  {/* Пробные занятия */}
                  <div className="grid-cols-2">
                    <div className="space-y-1">
                      <Label htmlFor="trialScheduled" className="font-medium">
                        Записано на пробные
                      </Label>
                      <Input
                        id="trialScheduled"
                        type="number"
                        min="0"
                        className="h-9"
                        value={formData.trialScheduled}
                        onChange={(e) =>
                          setFormData({ ...formData, trialScheduled: e.target.value })
                        }
                      />
                    </div>

                    <div className="space-y-1">
                      <Label htmlFor="trialAttended" className="font-medium">
                        Пришло на пробные
                      </Label>
                      <Input
                        id="trialAttended"
                        type="number"
                        min="0"
                        className="h-9"
                        value={formData.trialAttended}
                        onChange={(e) =>
                          setFormData({ ...formData, trialAttended: e.target.value })
                        }
                      />
                    </div>
                  </div>

                  {/* Оповестили */}
                  <div className="space-y-2">
                    <Label className="font-medium">Оповестили о пробных на завтра?</Label>
                    <RadioGroup
                      value={formData.notifiedTomorrow}
                      onValueChange={(value) =>
                        setFormData({ ...formData, notifiedTomorrow: value })
                      }
                      className="flex gap-4"
                    >
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="да" id="yes" />
                        <Label htmlFor="yes" className="font-normal">
                          Да
                        </Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="нет" id="no" />
                        <Label htmlFor="no" className="font-normal">
                          Нет
                        </Label>
                      </div>
                    </RadioGroup>
                  </div>

                  {/* Переносы/отмены */}
                  <div className="space-y-1">
                    <Label htmlFor="cancellations" className="font-medium">
                      Переносы/отмены
                    </Label>
                    <Textarea
                      id="cancellations"
                      value={formData.cancellations}
                      onChange={(e) =>
                        setFormData({ ...formData, cancellations: e.target.value })
                      }
                      className="resize-none"
                      rows={2}
                    />
                  </div>

                  {/* Отток */}
                  <div className="space-y-1">
                    <Label htmlFor="churn" className="font-medium">
                      Отток (кто и причины)
                    </Label>
                    <Textarea
                      id="churn"
                      value={formData.churn}
                      onChange={(e) =>
                        setFormData({ ...formData, churn: e.target.value })
                      }
                      className="resize-none"
                      rows={2}
                    />
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="finance">
                <div className="tab-content-wrapper">
                  {/* Деньги */}
                  <div className="space-y-2">
                    <Label className="font-medium">Поступило денег</Label>
                    <div className="grid-cols-3">
                      <div className="space-y-1">
                        <Label htmlFor="cash" className="text-sm text-muted-foreground">
                          Наличные
                        </Label>
                        <Input
                          id="cash"
                          type="number"
                          min="0"
                          className="h-9"
                          value={formData.money.cash}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              money: { ...formData.money, cash: e.target.value },
                            })
                          }
                        />
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor="mobileBank" className="text-sm text-muted-foreground">
                          Моб. банк
                        </Label>
                        <Input
                          id="mobileBank"
                          type="number"
                          min="0"
                          className="h-9"
                          value={formData.money.mobileBank}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              money: { ...formData.money, mobileBank: e.target.value },
                            })
                          }
                        />
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor="nonCash" className="text-sm text-muted-foreground">
                          Безнал
                        </Label>
                        <Input
                          id="nonCash"
                          type="number"
                          min="0"
                          className="h-9"
                          value={formData.money.nonCash}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              money: { ...formData.money, nonCash: e.target.value },
                            })
                          }
                        />
                      </div>
                    </div>
                  </div>

                  {/* Вода */}
                  <div className="space-y-1">
                    <Label htmlFor="water" className="font-medium">
                      Вода
                    </Label>
                    <Textarea
                      id="water"
                      value={formData.water}
                      onChange={(e) =>
                        setFormData({ ...formData, water: e.target.value })
                      }
                      className="resize-none"
                      rows={2}
                    />
                  </div>

                  {/* Закупки */}
                  <div className="space-y-1">
                    <Label htmlFor="supplies" className="font-medium">
                      Закупки (канцелярия, хоз.товары)
                    </Label>
                    <Textarea
                      id="supplies"
                      value={formData.supplies}
                      onChange={(e) =>
                        setFormData({ ...formData, supplies: e.target.value })
                      }
                      className="resize-none"
                      rows={2}
                    />
                  </div>

                  {/* Комментарии */}
                  <div className="space-y-1">
                    <Label htmlFor="comments" className="font-medium">
                      Комментарии и вопросы
                    </Label>
                    <Textarea
                      id="comments"
                      value={formData.comments}
                      onChange={(e) =>
                        setFormData({ ...formData, comments: e.target.value })
                      }
                      className="resize-none"
                      rows={3}
                    />
                  </div>
                </div>
              </TabsContent>
            </Tabs>

            {/* Кнопка сохранить */}
            <Button
              type="button"
              onClick={handleSave}
              variant="outline"
              className="save-button"
            >
              Сохранить
            </Button>
          </div>
        </div>
      </form>

      {showTaskForm && (
        <TaskForm
          onSubmit={handleCreateTask}
          onClose={() => setShowTaskForm(false)}
        />
      )}

      {viewTask && (
        <ReportTaskDetail
          task={viewTask}
          onClose={() => setViewTask(null)}
          onStatusChange={(id, s) => {
            handleUpdateStatus(id, s);
            setViewTask(t => ({ ...t, status: s }));
          }}
          getStatusBadgeClass={getStatusBadgeClass}
          getStatusLabel={getStatusLabel}
          getDeadlineBadge={getDeadlineBadge}
        />
      )}
    </div>
  );
}

function ReportTaskDetail({ task, onClose, onStatusChange, getStatusBadgeClass, getStatusLabel, getDeadlineBadge }) {
  const dl = getDeadlineBadge(task);
  const fmt = (s) => s ? new Date(s).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—';

  return (
    <div className="task-detail-overlay" onClick={onClose}>
      <div className="task-detail-modal" onClick={(e) => e.stopPropagation()}>
        <div className="task-detail-header">
          <h3>{task.title}</h3>
          <button type="button" onClick={onClose} className="task-detail-close">✕</button>
        </div>
        <div className="task-detail-content">
          {task.description && <p className="task-detail-desc">{task.description}</p>}
          <div className="task-detail-meta">
            {dl && <div><span className="meta-label">Дедлайн</span><span className={`deadline-badge ${dl[1]}`}>{dl[0]}</span></div>}
            {task.deadline && <div><span className="meta-label">Время</span><span>{fmt(task.deadline)}</span></div>}
            <div><span className="meta-label">Исполнитель</span><span>{task.assigned_to_name || '—'}</span></div>
            <div><span className="meta-label">Создал</span><span>{task.created_by_name || '—'}</span></div>
            <div><span className="meta-label">Создана</span><span>{fmt(task.created_at)}</span></div>
            {task.completed_at && <div><span className="meta-label">Выполнена</span><span>{fmt(task.completed_at)}</span></div>}
          </div>
          {task.linked_students && task.linked_students.length > 0 && (
            <div className="task-detail-students">
              <span className="meta-label">Студенты</span>
              {task.linked_students.map(s => (
                <div key={s.id} className="task-student-item">
                  <span>{s.fio}</span>
                  {s.phone && <a href={`tel:${s.phone}`}>{s.phone}</a>}
                </div>
              ))}
            </div>
          )}
          <div className="task-detail-status">
            <span className="meta-label">Статус</span>
            <select
              className={`status-select-compact ${getStatusBadgeClass(task.status)}`}
              value={task.status}
              onChange={(e) => onStatusChange(task.id, e.target.value)}
            >
              <option value="new">Новая</option>
              <option value="in_progress">В работе</option>
              <option value="completed">Выполнена</option>
              <option value="postponed">Перенесена на завтра</option>
            </select>
          </div>
        </div>
      </div>
    </div>
  );
}
