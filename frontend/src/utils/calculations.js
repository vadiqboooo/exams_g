// Расчет итогового балла по первичным баллам (шкала ЕГЭ)
export function calculateTotalScore(subject, answers) {
  if (!answers || answers.length === 0) return 0;
  
  const primary = answers.reduce((sum, s) => {
    const trimmed = s ? s.trim() : '';
    return sum + (trimmed !== '-' ? (parseInt(trimmed) || 0) : 0);
  }, 0);

  // Пример для профильной математики 2025 (примерные данные)
  if (subject === 'math_profile') {
    const scale = [
      0, 6, 11, 17, 22, 27, 34, 40, 46, 52, 58, 64, 70, 72, 74, 76, 78, 80, 82, 84, 86, 88, 90, 92, 94, 95, 96, 97, 98, 99, 100, 100, 100
    ];
    return primary < scale.length ? scale[primary] : 100;
  }
  
  if (subject === 'infa') {
    const scale = [
      0, 7, 14, 20, 27, 34, 40, 43, 46, 48, 51, 54, 56, 59, 62, 64, 67, 70, 72, 75, 78, 80, 83, 85, 88, 90, 93, 95, 98, 100
    ];
    return primary < scale.length ? scale[primary] : 100;
  }
  
  if (subject === 'rus') {
    const scale = [
      0, 3, 5, 8, 10, 12, 14, 17, 20, 22, 24, 27, 29, 32, 34, 36, 37, 39, 40, 42, 43, 45, 46, 48, 49, 51, 52, 54, 55, 57, 58, 60, 61, 63, 64, 66, 67, 69, 70, 70, 73, 75, 78, 81, 83, 86, 89, 91, 94, 97, 100
    ];
    return primary < scale.length ? scale[primary] : 100;
  }
  
  if (subject === 'soc') {
    const scale = [
      0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22, 24, 26, 28, 30, 32, 34, 36, 38, 40, 42, 44, 45, 47, 48, 49, 51, 52, 53, 55, 56, 57, 59, 60, 62, 63, 64, 66, 67, 68, 70, 71, 72, 73, 75, 77, 79, 81, 83, 85, 86, 88, 90, 92, 94, 96, 98, 100
    ];
    return primary < scale.length ? scale[primary] : 100;
  }
  
  if (subject === 'eng') {
    const scale = [
      0, 2, 3, 4, 5, 7, 8, 9, 10, 11, 13, 14, 15, 16, 18, 19, 20, 21, 22, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 36, 37, 38, 39, 40, 41, 42, 43, 44, 45, 46, 48, 49, 50, 51, 52, 53, 54, 55, 56, 57, 58, 60, 61, 62, 63, 64, 65, 66, 67, 68, 69, 70, 71, 73, 74, 75, 76, 77, 78, 79, 80, 81, 82, 84, 86, 88, 90, 92, 94, 96, 98, 100
    ];
    return primary < scale.length ? scale[primary] : 100;
  }
  
  if (subject === 'math_base') {
    const scale = [ 
      2, 2, 2, 2, 2, 2, 2, 3, 3, 3, 3, 3, 4, 4, 4, 4, 4, 5, 5, 5, 5, 5
    ];
    return primary < scale.length ? scale[primary] : 5;
  }
  
  if (subject === 'phys') {
    const scale = [
      0, 5, 9, 14, 18, 23, 27, 32, 36, 39, 41, 43, 44, 46, 48, 49, 51, 53, 54, 56, 58, 59, 61, 62, 64, 65, 67, 68, 70, 71, 73, 74, 76, 77, 79, 80, 82, 84, 86, 88, 90, 92, 94, 96, 98, 100
    ];
    return primary < scale.length ? scale[primary] : 100;
  }
  
  if (subject === 'hist') {
    const scale = [
      0, 4, 8, 12, 16, 20, 24, 28, 32, 34, 36, 38, 40, 42, 44, 45, 47, 49, 51, 53, 55, 57, 58, 60, 62, 64, 66, 68, 70, 72, 74, 76, 78, 80, 82, 84, 87, 89, 91, 93, 95, 97, 100
    ];
    return primary < scale.length ? scale[primary] : 100;
  }
  
  if (subject === 'bio') {
    const scale = [
      0, 3, 5, 7, 10, 12, 14, 17, 19, 21, 24, 26, 28, 31, 33, 36, 38, 40, 41, 43, 45, 46, 48, 50, 51, 53, 55, 56, 58, 60, 61, 63, 65, 66, 68, 70, 71, 72, 73, 74, 75, 76, 77, 78, 79, 80, 81, 83, 85, 86, 88, 90, 91, 93, 95, 96, 98, 100
    ];
    return primary < scale.length ? scale[primary] : 100;
  }
  
  return primary; // для остальных — просто первичный балл
}

// Расчет первичного балла для infa_9 с учетом парных заданий (13.1/13.2 и 14.1/14.2)
function calculateInfa9Score(answers, maxPerTask) {
  if (!answers || answers.length === 0) return 0;
  
  let sum = 0;
  
  // Обрабатываем задания 1-12 (индексы 0-11)
  for (let i = 0; i < 12 && i < answers.length; i++) {
    const trimmed = answers[i] ? answers[i].trim() : '';
    if (trimmed !== '-') {
      const score = parseInt(trimmed) || 0;
      const max = maxPerTask && maxPerTask[i] !== undefined ? maxPerTask[i] : score;
      sum += Math.min(score, max);
    }
  }
  
  // Обрабатываем пару заданий 13.1 и 13.2 (индексы 12 и 13)
  const task13_1 = answers[12] ? answers[12].trim() : '';
  const task13_2 = answers[13] ? answers[13].trim() : '';
  const score13_1 = task13_1 !== '-' ? (parseInt(task13_1) || 0) : 0;
  const score13_2 = task13_2 !== '-' ? (parseInt(task13_2) || 0) : 0;
  
  // Логика: если есть оба - учитываем только 13.1, иначе учитываем тот, который есть
  if (score13_1 > 0 && score13_2 > 0) {
    const max = maxPerTask && maxPerTask[12] !== undefined ? maxPerTask[12] : score13_1;
    sum += Math.min(score13_1, max);
  } else if (score13_1 > 0) {
    const max = maxPerTask && maxPerTask[12] !== undefined ? maxPerTask[12] : score13_1;
    sum += Math.min(score13_1, max);
  } else if (score13_2 > 0) {
    const max = maxPerTask && maxPerTask[13] !== undefined ? maxPerTask[13] : score13_2;
    sum += Math.min(score13_2, max);
  }
  
  // Обрабатываем задание 14 как обычное (индекс 14)
  if (answers.length > 14) {
    const trimmed = answers[14] ? answers[14].trim() : '';
    if (trimmed !== '-') {
      const score = parseInt(trimmed) || 0;
      const max = maxPerTask && maxPerTask[14] !== undefined ? maxPerTask[14] : score;
      sum += Math.min(score, max);
    }
  }
  
  // Обрабатываем остальные задания (15, 16 -> индексы 15, 16)
  for (let i = 15; i < answers.length; i++) {
    const trimmed = answers[i] ? answers[i].trim() : '';
    if (trimmed !== '-') {
      const score = parseInt(trimmed) || 0;
      const max = maxPerTask && maxPerTask[i] !== undefined ? maxPerTask[i] : score;
      sum += Math.min(score, max);
    }
  }
  
  return sum;
}

// Расчет первичного балла с учетом максимальных баллов за задания
export function calculatePrimaryScore(answers, subject = null, maxPerTask = null) {
  if (!answers || answers.length === 0) return 0;

  // Специальная обработка для infa_9 с парными заданиями
  if (subject === 'infa_9') {
    return calculateInfa9Score(answers, maxPerTask);
  }

  return answers.reduce((sum, s, index) => {
    const trimmed = s ? s.trim() : '';
    if (trimmed === '-') return sum;

    const score = parseInt(trimmed) || 0;

    // Если есть maxPerTask, проверяем, что балл не превышает максимум
    if (maxPerTask && maxPerTask[index] !== undefined) {
      const max = maxPerTask[index];
      // Если балл превышает максимум, используем максимум (для безопасности)
      return sum + Math.min(score, max);
    }

    return sum + score;
  }, 0);
}

// Расчет баллов для экзамена (для публичной страницы результатов)
export function calculateScoreForExam(answer, subject) {
  if (!answer || !answer.trim()) {
    return { primary: '-', secondary: '' };
  }

  // Парсим ответы (разделены запятыми, пробелами или тире)
  const answers = answer.split(/[,\s]+/).map(s => s.trim()).filter(s => s);

  // Получаем первичный балл
  const primaryScore = calculatePrimaryScore(answers, subject);

  // Для предметов с тестовыми баллами рассчитываем их
  const hasTestScore = ['rus', 'math_profile', 'infa', 'phys', 'hist', 'bio', 'soc', 'eng'].includes(subject);

  if (hasTestScore) {
    const testScore = calculateTotalScore(subject, answers);
    return {
      primary: primaryScore.toString(),
      secondary: testScore.toString()
    };
  }

  // Для ОГЭ и базовой математики - только первичный балл
  return {
    primary: primaryScore.toString(),
    secondary: ''
  };
}