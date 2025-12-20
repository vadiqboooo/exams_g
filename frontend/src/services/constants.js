// Единственный источник данных о предметах
export const SUBJECT_TASKS = {
  'rus': { name: 'Русский язык', tasks: 27, maxPerTask: [1,1,1,1,1,1,1,2,1,1,1,1,1,1,1,1,1,1,1,1,1,2,1,1,1,1,22] },
  'math_profile': { name: 'Математика (профиль)', tasks: 19, maxPerTask: [1,1,1,1,1,1,1,1,1,1,1,1,2,2,3,3,3,4,5] },
  'math_base': { name: 'Математика (база)', tasks: 21, maxPerTask: [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1] },
  'phys': { name: 'Физика', tasks: 26, maxPerTask: [1,1,1,1,2,2,1,1,2,2,1,1,1,2,2,1,2,2,1,1,3,2,2,3,3,4] }, 
  'infa': { name: 'Информатика', tasks: 27, maxPerTask: [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,2,2] },
  'chem': { name: 'Химия', tasks: 34, maxPerTask: [1,1,1,1,1,2,2,2,1,1,1,1,1,2,2,1,1,1,1,1,1,2,2,2,1,1,1,1,2,2,4,5,3,4] },
  'bio': { name: 'Биология', tasks: 28, maxPerTask: [1,2,1,1,1,2,2,2,1,2,2,2,1,2,2,2,2,2,2,2,2,3,3,3,3,3,3,3] },
  'hist': { name: 'История', tasks: 21, maxPerTask: [2,1,2,3,2,2,2,1,1,1,1,2,2,2,2,2,3,3,2,3,3] },
  'soc': { name: 'Обществознание', tasks: 25, maxPerTask: [1,2,1,2,2,2,2,2,1,2,2,1,2,2,2,2,2,2,3,3,3,4,3,4,6] },
  'eng': { name: 'Английский язык', tasks: 38, maxPerTask: [2,3,1,1,1,1,1,1,1,3,2,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,6,14,1,4,5,10] },
  // ОГЭ
  'math_9': { name: 'Математика', tasks: 25, maxPerTask: [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,2,2,2,2,2,2] },
  'rus_9': { name: 'Русский язык', tasks: 18, maxPerTask: [6,1,1,1,1,1,1,1,1,1,1,1,7,3,3,3,3,1] },
  'infa_9': {name: 'Информатика', tasks: 17, maxPerTask: [1,1,1,1,1,1,1,1,1,1,1,1,2,2,3,2,2]}, // Задание 13 разделено на 13.1/13.2, задание 14 обычное
  'soc_9': {name: 'Обществознание', tasks: 24, maxPerTask: [2,1,1,1,3,2,1,1,1,1,1,4,1,1,2,1,1,1,1,1,2,2,3,2]},
  'hist_9': {name: 'История', tasks: 32, maxPerTask: [6, 1,1,1,1, 1,1,1,1, 6,4,1,1,1, 1,1,1,1, 1,1,1,1,1,1, 1,1,1,8,12,5,7,8]},
  'phys_9': {name: 'Физика', tasks: 22, maxPerTask: [2,2,1,2,1, 1,1,1,1,1,1, 2,2,2, 1,2,3,2, 2,3,3,3 ]},
  'bio_9': {name: 'Биология', tasks: 26, maxPerTask: [1,1,1,2,2,1,2,1,2,2,2,1,3,1,1,2,2,2,2,1,2,2,2,3,3,3]},
  'geo_9': {name: 'География', tasks: 30, maxPerTask: [1,1,1,1,1,1,1,1,1,1,1,2,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1]},
  'eng_9': {name: 'Английский язык', tasks: 38, maxPerTask: [1,1,1,1,5,1,1,1,1,1,1,6,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,10,2,6,7]},
};

// Генерация названия предмета на основе SUBJECT_TASKS
export function getSubjectDisplayName(subject) {
  if (!subject) return subject;
  
  // Если предмет есть в SUBJECT_TASKS, используем его название
  if (SUBJECT_TASKS[subject]) {
    return SUBJECT_TASKS[subject].name;
  }
  
  // Для специальных случаев, которых нет в SUBJECT_TASKS
  const specialCases = {
    'geo': 'География',
    'custom': 'Другое'
  };
  
  return specialCases[subject] || subject;
}

// Генерация списка опций для select на основе SUBJECT_TASKS
export function getSubjectOptions() {
  const options = Object.keys(SUBJECT_TASKS).map(key => ({
    value: key,
    label: SUBJECT_TASKS[key].name
  }));
  
  // Добавляем опцию "Другое" в конец
  options.push({ value: 'custom', label: 'Другое' });
  
  return options;
}

// Экспорт константы для обратной совместимости (генерируется автоматически)
export const SUBJECT_OPTIONS = getSubjectOptions();

export const API_BASE = import.meta.env.VITE_API_BASE_URL || 
                         (import.meta.env.DEV ? 'http://127.0.0.1:8000' : '');