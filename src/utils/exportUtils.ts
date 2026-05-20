/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Employee, VacationBooking, DayType } from '../types';
import { getEmployeeDayStatus, formatDate, calculateMonthStats, calculateRangeStats } from '../utils';

/**
 * Helper to trigger file download in the browser
 */
function downloadBlob(content: string, filename: string, contentType: string) {
  // Add UTF-8 BOM so Excel opens Cyrillic characters correctly
  const blob = new Blob(['\uFEFF' + content], { type: contentType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

const WEEKDAYS_RU = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];

function getDayTypeLabelRu(type: DayType, hours: number): string {
  switch (type) {
    case 'work':
      return `Работа (${hours} ч.)`;
    case 'rest':
      return 'Выходной';
    case 'vacation':
      return 'Отпуск';
    case 'sick':
      return `Больничный (${hours} ч.)`;
    default:
      return '';
  }
}

/**
 * Returns list of Date objects in range
 */
export function getDatesInRange(start: Date, end: Date): Date[] {
  const dates: Date[] = [];
  const current = new Date(start.getTime());
  const limit = new Date(end.getTime());
  current.setHours(0,0,0,0);
  limit.setHours(0,0,0,0);

  while (current.getTime() <= limit.getTime()) {
    dates.push(new Date(current.getTime()));
    current.setDate(current.getDate() + 1);
  }
  return dates;
}

/**
 * Exports employee schedule as a table matrix where columns are days
 */
export function exportScheduleToCSV(
  employees: Employee[],
  startDate: Date,
  endDate: Date,
  vacations: VacationBooking[],
  titleSuffix: string
) {
  const dates = getDatesInRange(startDate, endDate);
  
  // Header row 1: Date strings
  const headerDates = ['ФИО', 'Должность', ...dates.map(d => {
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    return `${day}.${month}`;
  })];

  // Header row 2: Day of the week names
  const headerDays = ['', '', ...dates.map(d => WEEKDAYS_RU[d.getDay()])];

  const rows: string[][] = [
    [`График смен ТК РФ (Период: ${titleSuffix})`],
    [],
    headerDates,
    headerDays
  ];

  employees.forEach(emp => {
    const empRow = [
      emp.name,
      emp.position,
      ...dates.map(d => {
        const status = getEmployeeDayStatus(emp, d, vacations);
        return getDayTypeLabelRu(status.type, status.hours);
      })
    ];
    rows.push(empRow);
  });

  const csvContent = rows
    .map(row => row.map(cell => `"${(cell || '').replace(/"/g, '""')}"`).join(';'))
    .join('\n');

  downloadBlob(csvContent, `schedule_${formatDate(startDate)}_to_${formatDate(endDate)}.csv`, 'text/csv;charset=utf-8;');
}

/**
 * Exports aggregated stats for each employee individually
 */
export function exportStatsToCSV(
  employees: Employee[],
  startDate: Date,
  endDate: Date,
  vacations: VacationBooking[],
  titleSuffix: string
) {
  const rows: string[][] = [
    [`Статистика выработки и учета по ТК РФ (Период: ${titleSuffix})`],
    [],
    [
      'ФИО сотрудника',
      'Должность',
      'Рабочие дни (смены)',
      'Отработано (часов)',
      'Дни отдыха',
      'Оплачиваемый отпуск (дней по ТК)',
      'Календарный отпуск (всего дней)',
      'Дни болезни',
      'Часы по больничным'
    ]
  ];

  employees.forEach(emp => {
    const stats = calculateRangeStats(emp, startDate, endDate, vacations);
    rows.push([
      emp.name,
      emp.position,
      stats.workDays.toString(),
      stats.workHours.toString(),
      stats.restDays.toString(),
      stats.vacationDays.toString(),
      stats.vacationCalendarDays.toString(),
      stats.sickDays.toString(),
      stats.sickHours.toString()
    ]);
  });

  const csvContent = rows
    .map(row => row.map(cell => `"${(cell || '').replace(/"/g, '""')}"`).join(';'))
    .join('\n');

  downloadBlob(csvContent, `statistics_${formatDate(startDate)}_to_${formatDate(endDate)}.csv`, 'text/csv;charset=utf-8;');
}
