export const getSubjectDisplayName = (subject) => {
  const map = {
    'math_profile': 'Математика (профиль)',
    'math_base': 'Математика (база)',
    'rus': 'Русский язык',
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