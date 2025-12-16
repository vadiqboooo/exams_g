export const SUBJECT_TASKS = {
  'rus': { name: 'Русский язык', tasks: 27, maxPerTask: [1,1,1,1,1,1,1,2,1,1,1,1,1,1,1,1,1,1,1,1,1,2,1,1,1,1,22] },
  'math_profile': { name: 'Математика (профиль)', tasks: 19, maxPerTask: [1,1,1,1,1,1,1,1,1,1,1,1,2,2,3,3,3,4,5] },
  'math_base': { name: 'Математика (база)', tasks: 21, maxPerTask: [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1] },
  'math_9': { name: 'Математика', tasks: 25, maxPerTask: [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,2,2,2,2,2,2] }, // Количество заданий будет задано в subject_task
  'rus_9': { name: 'Русский язык', tasks: 18, maxPerTask: [6,1,1,1,1,1,1,1,1,1,1,1,7,3,3,3,3,1] }, // Количество заданий будет задано в subject_task
  'phys': { name: 'Физика', tasks: 26, maxPerTask: [1,1,1,1,2,2,1,1,2,2,1,1,1,2,2,1,2,2,1,1,3,2,2,3,3,4] }, 
  'infa': { name: 'Информатика', tasks: 27, maxPerTask: [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,2,2] },
  'chem': { name: 'Химия', tasks: 34, maxPerTask: [] },
  'bio': { name: 'Биология', tasks: 28, maxPerTask: [1,2,1,1,1,2,2,2,1,2,2,2,1,2,2,2,2,2,2,2,2,3,3,3,3,3,3,3] },
  'hist': { name: 'История', tasks: 21, maxPerTask: [2,1,2,3,2,2,2,1,1,1,1,2,2,2,2,2,3,3,2,3,3] },
  'soc': { name: 'Обществознание', tasks: 25, maxPerTask: [1,2,1,2,2,2,2,2,1,2,2,1,2,2,2,2,2,2,3,3,3,4,3,4,6] },
  'eng': { name: 'Английский язык', tasks: 38, maxPerTask: [2,3,1,1,1,1,1,1,1,3,2,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,6,14,1,4,5,10] }
};

export const SUBJECT_OPTIONS = [
  { value: 'rus', label: 'Русский язык' },
  { value: 'math_profile', label: 'Математика (профильная)' },
  { value: 'math_base', label: 'Математика (базовая)' },
  { value: 'math_9', label: 'Математика (ОГЭ)' },
  { value: 'rus_9', label: 'Русский язык (ОГЭ)' },
  { value: 'phys', label: 'Физика' },
  { value: 'infa', label: 'Информатика' },
  { value: 'chem', label: 'Химия' },
  { value: 'bio', label: 'Биология' },
  { value: 'hist', label: 'История' },
  { value: 'soc', label: 'Обществознание' },
  { value: 'eng', label: 'Английский язык' },
  { value: 'custom', label: 'Другое' }
];

export const API_BASE = import.meta.env.VITE_API_BASE_URL || 
                         (import.meta.env.DEV ? 'http://127.0.0.1:8000' : '');

export function getSubjectDisplayName(subject) {
  const map = {
    'math_profile': 'Математика (профиль)',
    'math_base': 'Математика (база)',
    'math_9': 'Математика',
    'rus': 'Русский язык',
    'rus_9': 'Русский язык',
    'phys': 'Физика',
    'infa': 'Информатика',
    'chem': 'Химия',
    'bio': 'Биология',
    'hist': 'История',
    'soc': 'Обществознание',
    'geo': 'География',
    'eng': 'Английский язык'
  };
  return map[subject] || subject;
}