export const getSubjectDisplayName = (subject) => {
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
};

export const formatSchedule = (schedule) => {
  if (!schedule || Object.keys(schedule).length === 0) return '';
  
  const dayNames = {
    'monday': 'Пн',
    'tuesday': 'Вт',
    'wednesday': 'Ср',
    'thursday': 'Чт',
    'friday': 'Пт',
    'saturday': 'Сб',
    'sunday': 'Вс'
  };
  
  const scheduleItems = [];
  for (const [day, time] of Object.entries(schedule)) {
    if (time && time.trim()) {
      scheduleItems.push(`${dayNames[day] || day}: ${time}`);
    }
  }
  
  return scheduleItems.join(', ');
};

export const validateTaskInput = (value, max) => {
  let v = value.replace(/[^0-9\-]/g, '');
  if (v === '--') v = '-';
  if (v && v !== '-' && parseInt(v) > max) v = max.toString();
  return v;
};

// Функция склонения слов
export const getDeclension = (number, one, two, five) => {
  let n = Math.abs(number) % 100;
  let n1 = n % 10;
  if (n > 10 && n < 20) return five;
  if (n1 > 1 && n1 < 5) return two;
  if (n1 === 1) return one;
  return five;
};

// Функция форматирования номера задания
// Для rus_9 последние 5 заданий (14-18) отображаются как ГК1-ГК4 и ФК1
export const formatTaskNumber = (taskIndex, subject, totalTasks) => {
  // taskIndex - это индекс (0-based), нужно преобразовать в номер (1-based)
  const taskNumber = taskIndex + 1;
  
  // Для rus_9 последние 5 заданий (14-18) имеют специальные названия
  if (subject === 'rus_9') {
    // Задания 14-18 отображаются как ГК1-ГК4 и ФК1
    if (taskNumber === 14) {
      return 'ГК1';
    } else if (taskNumber === 15) {
      return 'ГК2';
    } else if (taskNumber === 16) {
      return 'ГК3';
    } else if (taskNumber === 17) {
      return 'ГК4';
    } else if (taskNumber === 18) {
      return 'ФК1';
    }
  }
  
  // Для всех остальных случаев возвращаем обычный номер
  return taskNumber.toString();
};