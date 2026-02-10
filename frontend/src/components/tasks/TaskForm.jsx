import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { Button } from '../ui/button';
import './TaskForm.css';

const API_BASE = import.meta.env.VITE_API_BASE_URL ||
                 (import.meta.env.DEV ? 'http://127.0.0.1:8000' : '');

const DEADLINE_PRESETS = [
  { key: 'urgent', label: '🔴 Срочно', description: '+2 часа' },
  { key: 'today', label: '🟡 До конца дня', description: '23:59' },
  { key: 'tomorrow', label: '🟢 До завтра', description: '18:00' },
  { key: 'custom', label: '📅 Своё время', description: '' },
];

function computeDeadline(type) {
  const now = new Date();
  switch (type) {
    case 'urgent': {
      const d = new Date(now.getTime() + 2 * 60 * 60 * 1000);
      return toLocalDatetimeInput(d);
    }
    case 'today': {
      const d = new Date(now);
      d.setHours(23, 59, 0, 0);
      return toLocalDatetimeInput(d);
    }
    case 'tomorrow': {
      const d = new Date(now);
      d.setDate(d.getDate() + 1);
      d.setHours(18, 0, 0, 0);
      return toLocalDatetimeInput(d);
    }
    default:
      return '';
  }
}

function toLocalDatetimeInput(date) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export default function TaskForm({ onSubmit, onClose }) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [deadlineType, setDeadlineType] = useState('');
  const [deadline, setDeadline] = useState('');
  const [assignedTo, setAssignedTo] = useState('');
  const [employees, setEmployees] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  // Students
  const [studentSearch, setStudentSearch] = useState('');
  const [allStudents, setAllStudents] = useState([]);
  const [allGroups, setAllGroups] = useState([]);
  const [linkedStudents, setLinkedStudents] = useState([]);
  const [showStudentDropdown, setShowStudentDropdown] = useState(false);
  const studentRef = useRef(null);

  const token = localStorage.getItem('token');
  const currentEmployeeId = localStorage.getItem('employee_id');

  useEffect(() => {
    fetchEmployees();
    fetchStudentsAndGroups();
  }, []);

  useEffect(() => {
    function handleClick(e) {
      if (studentRef.current && !studentRef.current.contains(e.target)) {
        setShowStudentDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const fetchEmployees = async () => {
    try {
      const res = await axios.get(`${API_BASE}/employees/assignable`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setEmployees(res.data);
      if (currentEmployeeId) setAssignedTo(currentEmployeeId);
    } catch (e) {
      console.error('Ошибка загрузки сотрудников:', e);
    }
  };

  const fetchStudentsAndGroups = async () => {
    try {
      const [studRes, grpRes] = await Promise.all([
        axios.get(`${API_BASE}/students/`, { headers: { Authorization: `Bearer ${token}` } }),
        axios.get(`${API_BASE}/groups/`, { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      setAllStudents(studRes.data);
      setAllGroups(grpRes.data);
    } catch (e) {
      console.error('Ошибка загрузки студентов/групп:', e);
    }
  };

  const handleDeadlinePreset = (key) => {
    setDeadlineType(key);
    if (key !== 'custom') {
      setDeadline(computeDeadline(key));
    }
  };

  const addStudent = (student) => {
    if (!linkedStudents.find(s => s.id === student.id)) {
      setLinkedStudents([...linkedStudents, { id: student.id, fio: student.fio, phone: student.phone }]);
    }
    setStudentSearch('');
    setShowStudentDropdown(false);
  };

  const addGroup = async (group) => {
    setStudentSearch('');
    setShowStudentDropdown(false);
    try {
      const res = await axios.get(`${API_BASE}/groups/${group.id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const groupStudents = res.data.students || [];
      const newStudents = groupStudents
        .filter(s => !linkedStudents.find(ls => ls.id === s.id))
        .map(s => ({ id: s.id, fio: s.fio, phone: s.phone }));
      if (newStudents.length > 0) {
        setLinkedStudents(prev => [...prev, ...newStudents]);
      }
    } catch (e) {
      console.error('Ошибка загрузки студентов группы:', e);
    }
  };

  const removeStudent = (id) => {
    setLinkedStudents(linkedStudents.filter(s => s.id !== id));
  };

  const filteredStudents = studentSearch.length >= 2
    ? allStudents.filter(s => s.fio.toLowerCase().includes(studentSearch.toLowerCase()))
    : [];

  const filteredGroups = studentSearch.length >= 2
    ? allGroups.filter(g => (g.name || '').toLowerCase().includes(studentSearch.toLowerCase()))
    : [];

  const showDropdown = showStudentDropdown && (filteredStudents.length > 0 || filteredGroups.length > 0);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title.trim() || !assignedTo) return;

    setIsLoading(true);
    await onSubmit({
      title,
      description: description || null,
      deadline: deadline || null,
      deadline_type: deadlineType || null,
      assigned_to_id: parseInt(assignedTo),
      linked_students: linkedStudents.length > 0 ? linkedStudents : null,
    });
    setIsLoading(false);
  };

  return (
    <div className="task-dialog-overlay" onClick={onClose}>
      <div className="task-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="task-dialog-header">
          <h2 className="task-dialog-title">Создать задачу</h2>
          <Button type="button" variant="ghost" size="sm" onClick={onClose} className="h-8 w-8 p-0">
            ✕
          </Button>
        </div>

        <form onSubmit={handleSubmit} className="task-dialog-body">
          {/* Название */}
          <div className="space-y-1">
            <Label htmlFor="task-title">Название *</Label>
            <Input
              id="task-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              placeholder="Введите название задачи"
            />
          </div>

          {/* Описание */}
          <div className="space-y-1">
            <Label htmlFor="task-description">Описание</Label>
            <Textarea
              id="task-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="resize-none"
              placeholder="Подробное описание задачи"
            />
          </div>

          {/* Дедлайн */}
          <div className="space-y-1">
            <Label>Дедлайн</Label>
            <div className="deadline-presets">
              {DEADLINE_PRESETS.map(p => (
                <button
                  key={p.key}
                  type="button"
                  className={`deadline-chip ${deadlineType === p.key ? 'active' : ''}`}
                  onClick={() => handleDeadlinePreset(p.key)}
                >
                  {p.label}
                  {p.description && <span className="deadline-chip-hint">{p.description}</span>}
                </button>
              ))}
            </div>
            {deadlineType === 'custom' && (
              <Input
                type="datetime-local"
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
                className="mt-1"
              />
            )}
          </div>

          {/* Назначить */}
          <div className="space-y-1">
            <Label htmlFor="task-assign">Назначить *</Label>
            <select
              id="task-assign"
              className="input"
              value={assignedTo}
              onChange={(e) => setAssignedTo(e.target.value)}
              required
            >
              <option value="">Выберите сотрудника</option>
              {employees.map(emp => (
                <option key={emp.id} value={emp.id}>
                  {emp.teacher_name}
                  {emp.id === parseInt(currentEmployeeId) ? ' (я)' : ''}
                  {emp.school ? ` — ${emp.school}` : ''}
                  {emp.role === 'owner' || emp.role === 'admin' ? ' [владелец]' : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Студенты */}
          <div className="space-y-1">
            <Label>Студенты / Группы</Label>
            <div className="student-picker" ref={studentRef}>
              <Input
                value={studentSearch}
                onChange={(e) => { setStudentSearch(e.target.value); setShowStudentDropdown(true); }}
                onFocus={() => setShowStudentDropdown(true)}
                placeholder="Поиск студента или группы..."
              />
              {showDropdown && (
                <div className="student-dropdown">
                  {filteredGroups.length > 0 && (
                    <div className="dropdown-section">
                      <div className="dropdown-section-label">Группы</div>
                      {filteredGroups.map(g => (
                        <button key={`g-${g.id}`} type="button" className="dropdown-item" onClick={() => addGroup(g)}>
                          <span className="dropdown-item-icon">👥</span>
                          <span>{g.name || `${g.exam_type} ${g.subject}`}</span>
                        </button>
                      ))}
                    </div>
                  )}
                  {filteredStudents.length > 0 && (
                    <div className="dropdown-section">
                      <div className="dropdown-section-label">Студенты</div>
                      {filteredStudents.map(s => (
                        <button key={`s-${s.id}`} type="button" className="dropdown-item" onClick={() => addStudent(s)}>
                          <span className="dropdown-item-icon">👤</span>
                          <span>{s.fio}</span>
                          {s.phone && <span className="dropdown-item-sub">{s.phone}</span>}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
            {linkedStudents.length > 0 && (
              <div className="student-tags">
                {linkedStudents.map(s => (
                  <span key={s.id} className="student-tag">
                    {s.fio}
                    <button type="button" onClick={() => removeStudent(s.id)}>✕</button>
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="task-dialog-footer">
            <Button type="button" variant="outline" onClick={onClose}>Отмена</Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? 'Создание...' : 'Создать'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
