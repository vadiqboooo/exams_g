import React, { useState, useEffect } from 'react';
import Modal from '../common/Modal';
import { useApi } from '../../hooks/useApi';
import { useStudents } from '../../hooks/useStudents';

const GroupForm = ({ group = null, students: studentsProp = [], onClose, showNotification }) => {
  const { makeRequest } = useApi();
  const { students: studentsFromHook, loadStudents } = useStudents();
  
  // Используем студентов из хука, если они есть, иначе из пропса
  const students = studentsFromHook.length > 0 ? studentsFromHook : studentsProp;
  
  // Загружаем студентов при открытии формы
  useEffect(() => {
    if (studentsFromHook.length === 0) {
      loadStudents();
    }
  }, [loadStudents, studentsFromHook.length]);
  const [teachers, setTeachers] = useState([]);
  const [teacherSearch, setTeacherSearch] = useState('');
  const [showTeacherDropdown, setShowTeacherDropdown] = useState(false);
  const [selectedTeacher, setSelectedTeacher] = useState(null);
  
  // Обратный маппинг для загрузки данных из API в форму
  const examTypeReverseMapping = {
    'ЕГЭ': 'ege',
    'ОГЭ': 'oge',
    '': ''
  };

  // Преобразуем subject для отображения в форме
  // Если subject = 'math_9', показываем 'math_profile' в селекте
  // Если subject = 'rus_9', показываем 'rus' в селекте
  const getDisplaySubject = (subject, examType) => {
    if (!subject) return '';
    if (examType === 'ОГЭ' || examType === 'oge') {
      if (subject === 'math_9') return 'math_profile';
      if (subject === 'rus_9') return 'rus';
    }
    return subject;
  };

  const [formData, setFormData] = useState({
    name: group?.name || '',
    teacher_id: group?.teacher_id || group?.teacher?.id || null,
    school: group?.school || '',
    subject: group?.subject ? getDisplaySubject(group.subject, group?.exam_type) : '',
    exam_type: group?.exam_type ? (examTypeReverseMapping[group.exam_type] || group.exam_type) : '',
    student_ids: group?.students?.map(s => s.id) || [],
    schedule: group?.schedule || {
      monday: '',
      tuesday: '',
      wednesday: '',
      thursday: '',
      friday: '',
      saturday: '',
      sunday: ''
    }
  });
  const [loading, setLoading] = useState(false);
  const [studentSearch, setStudentSearch] = useState('');

  // Загружаем список преподавателей
  useEffect(() => {
    const loadTeachers = async () => {
      try {
        const teachersList = await makeRequest('GET', '/teachers/');
        setTeachers(teachersList);
        
        // Если редактируем группу, устанавливаем выбранного преподавателя
        if (group) {
          const teacherId = group.teacher_id || group.teacher?.id;
          if (teacherId) {
            const teacher = teachersList.find(t => t.id === Number(teacherId));
            if (teacher) {
              setSelectedTeacher(teacher);
              setTeacherSearch(teacher.teacher_name || teacher.username || '');
              // Убеждаемся, что teacher_id установлен в formData как число
              setFormData(prev => ({ ...prev, teacher_id: Number(teacherId) }));
            } else {
              // Если преподаватель не найден в списке, но есть имя, показываем его
              const teacherName = group.teacher_name || group.teacher?.teacher_name || group.teacher?.name || '';
              if (teacherName) {
                setTeacherSearch(teacherName);
              }
              // Но все равно устанавливаем teacher_id если он есть
              setFormData(prev => ({ ...prev, teacher_id: Number(teacherId) }));
            }
          }
        }
      } catch (err) {
        console.error('Ошибка загрузки преподавателей:', err);
        showNotification('Не удалось загрузить список преподавателей', 'error');
      }
    };
    
    loadTeachers();
  }, [group, makeRequest, showNotification]);

  // Закрываем выпадающий список при клике вне поля
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (!event.target.closest('.teacher-select-wrapper')) {
        setShowTeacherDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Фильтруем преподавателей по поисковому запросу
  const filteredTeachers = teachers.filter(teacher => {
    const name = (teacher.teacher_name || '').toLowerCase();
    const search = teacherSearch.toLowerCase();
    return name.includes(search);
  });

  const handleTeacherSelect = (teacher) => {
    setSelectedTeacher(teacher);
    setFormData(prev => ({ ...prev, teacher_id: teacher.id }));
    setTeacherSearch(teacher.teacher_name || '');
    setShowTeacherDropdown(false);
  };

  const handleTeacherSearchChange = (e) => {
    const value = e.target.value;
    setTeacherSearch(value);
    setShowTeacherDropdown(true);
    
    // Если поле очищено, сбрасываем выбор
    if (!value.trim()) {
      setSelectedTeacher(null);
      setFormData(prev => ({ ...prev, teacher_id: null }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.name.trim() || !formData.teacher_id) {
      showNotification('Заполните обязательные поля', 'error');
      return;
    }

    setLoading(true);
    try {
      // Маппинг значений exam_type из формы в значения для API
      const examTypeMapping = {
        'ege': 'ЕГЭ',
        'oge': 'ОГЭ',
        'vpr': '',
        'test': '',
        'other': ''
      };
      
      if (group) {
        // Обновление группы - отправляем только поля, которые могут быть обновлены
        // Очищаем schedule от пустых значений
        const cleanedSchedule = formData.schedule ? 
          Object.fromEntries(
            Object.entries(formData.schedule).filter(([_, value]) => value && value.trim())
          ) : null;
        
        const updateData = {
          name: formData.name.trim()
        };
        
        // teacher_id должен быть числом
        if (formData.teacher_id) {
          updateData.teacher_id = Number(formData.teacher_id);
        }
        
        // Добавляем опциональные поля только если они заполнены
        if (formData.school && formData.school.trim()) {
          updateData.school = formData.school.trim();
        }
        
        // Обрабатываем exam_type и subject
        let finalSubject = formData.subject && formData.subject.trim() ? formData.subject.trim() : null;
        let finalExamType = null;
        
        if (formData.exam_type && formData.exam_type.trim()) {
          // Преобразуем exam_type из формы в формат для API
          const mappedExamType = examTypeMapping[formData.exam_type.trim()];
          if (mappedExamType !== undefined) {
            // Отправляем только если значение не пустое (для ЕГЭ и ОГЭ)
            if (mappedExamType) {
              finalExamType = mappedExamType;
              updateData.exam_type = finalExamType;
            }
          } else {
            // Если значение не в маппинге, отправляем как есть
            finalExamType = formData.exam_type.trim();
            updateData.exam_type = finalExamType;
          }
        }
        
        // Если выбран ОГЭ, автоматически заменяем предмет на math_9 или rus_9
        if (finalExamType === 'ОГЭ' && finalSubject) {
          if (finalSubject === 'rus' || finalSubject === 'Русский язык') {
            finalSubject = 'rus_9';
          } else if (finalSubject === 'math_profile' || finalSubject === 'math_base' || finalSubject === 'Математика') {
            finalSubject = 'math_9';
          }
        }
        
        if (finalSubject) {
          updateData.subject = finalSubject;
        }
        if (cleanedSchedule && Object.keys(cleanedSchedule).length > 0) {
          updateData.schedule = cleanedSchedule;
        }
        
        console.log('Sending update data:', JSON.stringify(updateData, null, 2));
        await makeRequest('PUT', `/groups/${group.id}`, updateData);
        
        // Обновляем состав студентов отдельным запросом
        if (formData.student_ids && Array.isArray(formData.student_ids)) {
          try {
            await makeRequest('PUT', `/groups/${group.id}/students/`, {
              student_ids: formData.student_ids
            });
          } catch (err) {
            console.error('Error updating group students:', err);
            showNotification('Группа обновлена, но не удалось обновить состав студентов', 'warning');
            onClose();
            return;
          }
        }
        
        showNotification('Группа обновлена', 'success');
      } else {
        // Создание группы
        // Очищаем schedule от пустых значений
        const cleanedSchedule = formData.schedule ? 
          Object.fromEntries(
            Object.entries(formData.schedule).filter(([_, value]) => value && value.trim())
          ) : null;
        
        const createData = {
          name: formData.name.trim(),
          teacher_id: Number(formData.teacher_id)
        };
        
        // Добавляем опциональные поля только если они заполнены
        if (formData.school && formData.school.trim()) {
          createData.school = formData.school.trim();
        }
        
        // Обрабатываем exam_type и subject
        let finalSubject = formData.subject && formData.subject.trim() ? formData.subject.trim() : null;
        let finalExamType = null;
        
        if (formData.exam_type && formData.exam_type.trim()) {
          // Преобразуем exam_type из формы в формат для API
          const mappedExamType = examTypeMapping[formData.exam_type.trim()];
          if (mappedExamType !== undefined) {
            // Отправляем только если значение не пустое (для ЕГЭ и ОГЭ)
            if (mappedExamType) {
              finalExamType = mappedExamType;
            }
          } else {
            // Если значение не в маппинге, отправляем как есть
            finalExamType = formData.exam_type.trim();
          }
        }
        
        // Если выбран ОГЭ, автоматически заменяем предмет на math_9 или rus_9
        if (finalExamType === 'ОГЭ' && finalSubject) {
          if (finalSubject === 'rus' || finalSubject === 'Русский язык') {
            finalSubject = 'rus_9';
          } else if (finalSubject === 'math_profile' || finalSubject === 'math_base' || finalSubject === 'Математика') {
            finalSubject = 'math_9';
          }
        }
        
        // Добавляем exam_type только если он установлен
        if (finalExamType) {
          createData.exam_type = finalExamType;
        }
        
        // Добавляем subject только если он установлен
        if (finalSubject) {
          createData.subject = finalSubject;
        }
        if (cleanedSchedule && Object.keys(cleanedSchedule).length > 0) {
          createData.schedule = cleanedSchedule;
        }
        
        console.log('Sending create data:', JSON.stringify(createData, null, 2));
        const createdGroup = await makeRequest('POST', '/groups/', createData);
        
        // Добавляем студентов в созданную группу
        if (formData.student_ids && formData.student_ids.length > 0) {
          try {
            await makeRequest('PUT', `/groups/${createdGroup.id}/students/`, {
              student_ids: formData.student_ids
            });
          } catch (err) {
            console.error('Error adding students to group:', err);
            showNotification('Группа создана, но не удалось добавить студентов', 'warning');
            onClose();
            return;
          }
        }
        
        showNotification('Группа создана', 'success');
      }
      onClose();
    } catch (err) {
      console.error('Error saving group:', err);
      showNotification(err.message || 'Ошибка сохранения', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleStudentToggle = (studentId) => {
    setFormData(prev => ({
      ...prev,
      student_ids: prev.student_ids.includes(studentId)
        ? prev.student_ids.filter(id => id !== studentId)
        : [...prev.student_ids, studentId]
    }));
  };

  const handleScheduleChange = (day, value) => {
    setFormData(prev => ({
      ...prev,
      schedule: {
        ...prev.schedule,
        [day]: value
      }
    }));
  };

  const daysOfWeek = [
    { id: 'monday', label: 'Понедельник' },
    { id: 'tuesday', label: 'Вторник' },
    { id: 'wednesday', label: 'Среда' },
    { id: 'thursday', label: 'Четверг' },
    { id: 'friday', label: 'Пятница' },
    { id: 'saturday', label: 'Суббота' },
    { id: 'sunday', label: 'Воскресенье' }
  ];

  return (
    <Modal onClose={onClose} size="lg">
      <form onSubmit={handleSubmit} className="group-form">
        <h2>{group ? 'Редактировать группу' : 'Создать группу'}</h2>

        <div className="form-row">
          <div className="form-group">
            <label>Название группы *</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Например: 11А класс, Группа 1"
              required
            />
          </div>

          <div className="form-group">
            <label>Преподаватель *</label>
            <div className="teacher-select-wrapper">
              <input
                type="text"
                value={teacherSearch}
                onChange={handleTeacherSearchChange}
                onFocus={() => setShowTeacherDropdown(true)}
                placeholder="Начните вводить имя преподавателя..."
                required
                autoComplete="off"
              />
              {showTeacherDropdown && filteredTeachers.length > 0 && (
                <div className="teacher-dropdown">
                  {filteredTeachers.map(teacher => (
                    <div
                      key={teacher.id}
                      className={`teacher-option ${selectedTeacher?.id === teacher.id ? 'selected' : ''}`}
                      onClick={() => handleTeacherSelect(teacher)}
                    >
                      {teacher.teacher_name || teacher.username}
                    </div>
                  ))}
                </div>
              )}
              {showTeacherDropdown && teacherSearch && filteredTeachers.length === 0 && (
                <div className="teacher-dropdown">
                  <div className="teacher-option no-results">Преподаватель не найден</div>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label>Школа</label>
            <input
              type="text"
              value={formData.school}
              onChange={(e) => setFormData({ ...formData, school: e.target.value })}
              placeholder="Название школы"
            />
          </div>

          <div className="form-group">
            <label>Предмет</label>
            <select
              value={formData.subject}
              onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
            >
              <option value="">Выберите предмет</option>
              {formData.exam_type === 'oge' ? (
                // Для ОГЭ показываем только специальные варианты
                <>
                  <option value="rus">Русский язык</option>
                  <option value="math_profile">Математика</option>
                </>
              ) : (
                // Для других типов экзаменов показываем все предметы
                <>
                  <option value="rus">Русский язык</option>
                  <option value="math_profile">Математика (профиль)</option>
                  <option value="math_base">Математика (база)</option>
                  <option value="phys">Физика</option>
                  <option value="infa">Информатика</option>
                  <option value="bio">Биология</option>
                  <option value="hist">История</option>
                  <option value="soc">Обществознание</option>
                  <option value="eng">Английский язык</option>
                </>
              )}
            </select>
          </div>

          <div className="form-group">
            <label>Тип экзамена</label>
            <select
              value={formData.exam_type}
              onChange={(e) => setFormData({ ...formData, exam_type: e.target.value })}
            >
              <option value="">Выберите тип</option>
              <option value="ege">ЕГЭ</option>
              <option value="oge">ОГЭ</option>
              <option value="vpr">ВПР</option>
              <option value="test">Контрольная</option>
              <option value="other">Другое</option>
            </select>
          </div>
        </div>

        <div className="form-section">
          <h3>Расписание занятий</h3>
          <div className="schedule-grid">
            {daysOfWeek.map(day => (
              <div key={day.id} className="schedule-item">
                <label>{day.label}</label>
                <input
                  type="text"
                  value={formData.schedule[day.id]}
                  onChange={(e) => handleScheduleChange(day.id, e.target.value)}
                  placeholder="18:00-19:30"
                />
              </div>
            ))}
          </div>
        </div>

        <div className="form-section">
          <h3>Студенты в группе</h3>
          <div className="students-selection">
            {students.length === 0 ? (
              <p className="no-students">Нет доступных студентов</p>
            ) : (
              <>
                <div className="student-search-box" style={{ marginBottom: '15px' }}>
                  <input
                    type="text"
                    placeholder="Поиск по имени или телефону..."
                    value={studentSearch}
                    onChange={(e) => setStudentSearch(e.target.value)}
                    className="student-search-input"
                    style={{
                      width: '100%',
                      padding: '10px',
                      border: '2px solid #e0e0e0',
                      borderRadius: '6px',
                      fontSize: '14px',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>
                <div className="students-checkbox-list">
                  {students
                    .filter(student => {
                      if (!studentSearch) return true;
                      const searchLower = studentSearch.toLowerCase();
                      const fio = (student.fio || '').toLowerCase();
                      const phone = (student.phone || '').toLowerCase();
                      return fio.includes(searchLower) || phone.includes(searchLower);
                    })
                    .sort((a, b) => {
                      // Студенты в группе (отмеченные) идут первыми
                      const aInGroup = formData.student_ids.includes(a.id);
                      const bInGroup = formData.student_ids.includes(b.id);
                      if (aInGroup && !bInGroup) return -1;
                      if (!aInGroup && bInGroup) return 1;
                      // Если оба в группе или оба не в группе, сортируем по ФИО
                      return (a.fio || '').localeCompare(b.fio || '');
                    })
                    .map(student => (
                      <label key={student.id} className="student-checkbox">
                        <input
                          type="checkbox"
                          checked={formData.student_ids.includes(student.id)}
                          onChange={() => handleStudentToggle(student.id)}
                        />
                        <span>{student.fio} {student.phone && `(${student.phone})`}</span>
                      </label>
                    ))}
                </div>
              </>
            )}
            <div className="selected-count">
              Выбрано: {formData.student_ids.length} студентов
            </div>
          </div>
        </div>

        <div className="form-actions">
          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? 'Сохранение...' : group ? 'Обновить' : 'Создать'}
          </button>
          <button type="button" onClick={onClose} className="btn btn-secondary">
            Отмена
          </button>
        </div>
      </form>
    </Modal>
  );
};

export default GroupForm;