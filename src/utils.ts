/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Employee, DayOverride, DayType, VacationBooking, MonthStats, EmployeeStatusType } from './types';

// Russian State Holidays according to Article 112 of the Labor Code of the Russian Federation (TK RF)
export const RUSSIAN_HOLIDAYS_MMDD = [
  '01-01', '01-02', '01-03', '01-04', '01-05', '01-06', '01-07', '01-08', // New Year, Christmas
  '02-23', // Defender of the Fatherland Day
  '03-08', // International Women's Day
  '05-01', // Spring and Labor Day
  '05-09', // Victory Day
  '06-12', // Russia Day
  '11-04', // Unity Day
];

export const ANCHOR_DATE = new Date(2026, 0, 1); // January 1, 2026 (Thursday)

/**
 * Format date as YYYY-MM-DD
 */
export function formatDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Parse YYYY-MM-DD string to Date object
 */
export function parseDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/**
 * Checks if a given date is a Russian state holiday
 */
export function isRussianHoliday(date: Date): boolean {
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return RUSSIAN_HOLIDAYS_MMDD.includes(`${m}-${d}`);
}

/**
 * Calculate difference in days between two Date objects (safe from DST shifts)
 */
export function getDaysDiff(d1: Date, d2: Date): number {
  const utc1 = Date.UTC(d1.getFullYear(), d1.getMonth(), d1.getDate());
  const utc2 = Date.UTC(d2.getFullYear(), d2.getMonth(), d2.getDate());
  return Math.floor((utc1 - utc2) / (1000 * 60 * 60 * 24));
}

/**
 * Standard work hours for a single day according to store policy:
 * - Holidays and Sundays: 8 hours
 * - Saturdays: 10 hours
 * - Weekdays (Monday-Friday):
 *   - April 1 to Sept 30 (months 3 to 8): 10 hours
 *   - Oct 1 to March 31: 11 hours
 */
export function getStandardHoursForDate(date: Date): number {
  if (isRussianHoliday(date)) {
    return 8;
  }
  const dayOfWeek = date.getDay();
  if (dayOfWeek === 0) { // Sunday
    return 8;
  }
  if (dayOfWeek === 6) { // Saturday
    return 10;
  }

  const month = date.getMonth(); // 0-indexed (Jan = 0, Apr = 3, Sep = 8, Dec = 11)
  if (month >= 3 && month <= 8) {
    return 10; // Summer weekday
  } else {
    return 11; // Winter weekday
  }
}

/**
 * Calculate the correct vacation timeframe under TK RF (Article 120).
 * National holidays falling within the vacation period are NOT counted in the requested paid days count.
 * This shifts the end date out by the count of holidays.
 */
export function calculateVacationDays(
  startDateStr: string,
  daysRequested: number
): { endDateStr: string; holidaysIncluded: string[] } {
  const startDate = parseDate(startDateStr);
  let currentDate = new Date(startDate.getTime());
  let daysCounted = 0;
  const holidaysIncluded: string[] = [];

  while (daysCounted < daysRequested) {
    if (isRussianHoliday(currentDate)) {
      holidaysIncluded.push(formatDate(currentDate));
    } else {
      daysCounted++;
    }
    
    // Stop incrementing date if we have matched all requested paid days
    if (daysCounted < daysRequested) {
      currentDate.setDate(currentDate.getDate() + 1);
    }
  }

  return {
    endDateStr: formatDate(currentDate),
    holidaysIncluded,
  };
}

/**
 * Get active status of an employee on a given calendar date from their status history.
 * If no history records are found before or on this date, defaults to 'active'.
 */
export function getEmployeeStatusOnDate(emp: Employee, date: Date): EmployeeStatusType {
  if (!emp.statusHistory || emp.statusHistory.length === 0) return 'active';
  
  const dateStr = formatDate(date);
  
  // Exclude future events
  const applicableRecords = emp.statusHistory.filter(r => r.date <= dateStr);
  if (applicableRecords.length === 0) {
    return 'active';
  }
  
  // Sort descending by date, then by timestamp to get the absolute latest status on that date
  const sorted = [...applicableRecords].sort((a, b) => {
    const dateComp = b.date.localeCompare(a.date);
    if (dateComp !== 0) return dateComp;
    return b.timestamp - a.timestamp;
  });
  
  return sorted[0].status;
}

/**
 * Calculate the status and hours for an employee on a given day,
 * checking vacation bookings, manual edits, and the default 4/2 shift rotation.
 */
export function getEmployeeDayStatus(
  employee: Employee,
  date: Date,
  vacations: VacationBooking[]
): { type: DayType; hours: number; isOverridden: boolean; source: 'rotation' | 'vacation' | 'manual' } {
  const dateStr = formatDate(date);

  // Check if before hireDate
  if (employee.hireDate && dateStr < employee.hireDate) {
    return {
      type: 'rest',
      hours: 0,
      isOverridden: false,
      source: 'rotation',
    };
  }

  // 1. Check manual overrides first
  if (employee.dateOverrides && employee.dateOverrides[dateStr]) {
    const override = employee.dateOverrides[dateStr];
    return {
      type: override.type,
      hours: override.hours,
      isOverridden: true,
      source: 'manual',
    };
  }

  // 2. Check vacation bookings
  const isVacation = vacations.some((v) => {
    if (v.employeeId !== employee.id) return false;
    const startNum = parseDate(v.startDate).getTime();
    const endNum = parseDate(v.endDate).getTime();
    const currentNum = date.getTime();
    return currentNum >= startNum && currentNum <= endNum;
  });

  if (isVacation) {
    return {
      type: 'vacation',
      hours: 0, // Vacation days have 0 working hours
      isOverridden: false,
      source: 'vacation',
    };
  }

  // 3. Fallback to default 4/2 rotation
  const diffDays = getDaysDiff(date, ANCHOR_DATE);
  const cycleIndex = (((diffDays + employee.startOffset) % 6) + 6) % 6;

  // 4 days of work, 2 days of rest
  const isWorkDay = cycleIndex >= 0 && cycleIndex <= 3;
  
  if (isWorkDay) {
    return {
      type: 'work',
      hours: getStandardHoursForDate(date),
      isOverridden: false,
      source: 'rotation',
    };
  } else {
    return {
      type: 'rest',
      hours: 0,
      isOverridden: false,
      source: 'rotation',
    };
  }
}

/**
 * Checks constraints for summer period (April 1 to Sept 30) for a given employee & month:
 * - Total hours must be EXACTLY 185.
 * - For 30-day month: max 20 working days.
 * - For 31-day month: max 21 working days.
 */
export interface ConstraintResult {
  isSummerMonth: boolean;
  totalDaysInMonth: number;
  workDaysCount: number;
  totalHours: number;
  hoursValid: boolean;
  daysValid: boolean;
  warnings: string[];
}

export function checkSummerConstraints(
  employee: Employee,
  year: number,
  monthIndex: number, // 0-indexed
  vacations: VacationBooking[],
  summerLimit: number = 185
): ConstraintResult {
  const isSummer = monthIndex >= 3 && monthIndex <= 8; // April (3) to September (8)
  const totalDays = new Date(year, monthIndex + 1, 0).getDate();

  let workDaysCount = 0;
  let totalHours = 0;

  for (let day = 1; day <= totalDays; day++) {
    const d = new Date(year, monthIndex, day);
    const dayInfo = getEmployeeDayStatus(employee, d, vacations);
    if (dayInfo.type === 'work') {
      workDaysCount++;
      totalHours += dayInfo.hours;
    }
  }

  const warnings: string[] = [];
  let hoursValid = true;
  let daysValid = true;

  if (isSummer) {
    // Check hours constraint: must be exactly summerLimit
    if (totalHours !== summerLimit) {
      hoursValid = false;
      const diff = totalHours - summerLimit;
      if (diff > 0) {
        warnings.push(`Превышен лимит рабочих часов: ${totalHours} ч. вместо нормированных ${summerLimit} ч. (переработка +${diff} ч.)`);
      } else {
        warnings.push(`Недостаточно рабочих часов: ${totalHours} ч. вместо нормированных ${summerLimit} ч. (недоработка ${diff} ч.)`);
      }
    }

    // Check days limit
    if (totalDays === 30 && workDaysCount > 20) {
      daysValid = false;
      warnings.push(`Для месяца из 30 дней превышен лимит рабочих смен: ${workDaysCount} (макс. 20)`);
    } else if (totalDays === 31 && workDaysCount > 21) {
      daysValid = false;
      warnings.push(`Для месяца из 31 дня превышен лимит рабочих смен: ${workDaysCount} (макс. 21)`);
    }
  }

  return {
    isSummerMonth: isSummer,
    totalDaysInMonth: totalDays,
    workDaysCount,
    totalHours,
    hoursValid,
    daysValid,
    warnings,
  };
}

/**
 * Calculates complete month-level statistics for an employee
 */
export function calculateMonthStats(
  employee: Employee,
  year: number,
  monthIndex: number,
  vacations: VacationBooking[]
): MonthStats {
  const totalDays = new Date(year, monthIndex + 1, 0).getDate();
  
  let workDays = 0;
  let workHours = 0;
  let restDays = 0;
  let vacationDays = 0; // paid requested days
  let vacationCalendarDays = 0; // physical total days
  let sickDays = 0;
  let sickHours = 0;

  // Track holidays to count only paid vacation days inside vacation bookings
  const parsedVacationsInMonth = vacations.filter(v => v.employeeId === employee.id);

  for (let d = 1; d <= totalDays; d++) {
    const date = new Date(year, monthIndex, d);
    const dateStr = formatDate(date);
    const dayInfo = getEmployeeDayStatus(employee, date, vacations);

    switch (dayInfo.type) {
      case 'work':
        workDays++;
        workHours += dayInfo.hours;
        break;
      case 'rest':
        restDays++;
        break;
      case 'vacation':
        vacationCalendarDays++;
        // Vacation day counts as "paid" vacation only if it is not a national holiday under TK RF
        if (!isRussianHoliday(date)) {
          vacationDays++;
        }
        break;
      case 'sick':
        sickDays++;
        sickHours += dayInfo.hours;
        break;
    }
  }

  return {
    workDays,
    workHours,
    restDays,
    vacationDays,
    vacationCalendarDays,
    sickDays,
    sickHours,
  };
}

/**
 * Calculates complete range-level statistics for an employee between startDate and endDate (inclusive)
 */
export function calculateRangeStats(
  employee: Employee,
  startDate: Date,
  endDate: Date,
  vacations: VacationBooking[]
): MonthStats {
  let workDays = 0;
  let workHours = 0;
  let restDays = 0;
  let vacationDays = 0;
  let vacationCalendarDays = 0;
  let sickDays = 0;
  let sickHours = 0;

  const current = new Date(startDate.getTime());
  const limit = new Date(endDate.getTime());
  current.setHours(0, 0, 0, 0);
  limit.setHours(0, 0, 0, 0);

  while (current.getTime() <= limit.getTime()) {
    const dayInfo = getEmployeeDayStatus(employee, current, vacations);

    switch (dayInfo.type) {
      case 'work':
        workDays++;
        workHours += dayInfo.hours;
        break;
      case 'rest':
        restDays++;
        break;
      case 'vacation':
        vacationCalendarDays++;
        if (!isRussianHoliday(current)) {
          vacationDays++;
        }
        break;
      case 'sick':
        sickDays++;
        sickHours += dayInfo.hours;
        break;
    }
    current.setDate(current.getDate() + 1);
  }

  return {
    workDays,
    workHours,
    restDays,
    vacationDays,
    vacationCalendarDays,
    sickDays,
    sickHours,
  };
}


export const TAILWIND_COLORS: Record<string, { bg: string; text: string; border: string; hover: string; ring: string; lightbg: string }> = {
  indigo: {
    bg: 'bg-indigo-600',
    text: 'text-indigo-600',
    border: 'border-indigo-600',
    hover: 'hover:bg-indigo-100',
    ring: 'focus:ring-indigo-500',
    lightbg: 'bg-indigo-50'
  },
  emerald: {
    bg: 'bg-emerald-600',
    text: 'text-emerald-600',
    border: 'border-emerald-600',
    hover: 'hover:bg-emerald-100',
    ring: 'focus:ring-emerald-500',
    lightbg: 'bg-emerald-50'
  },
  amber: {
    bg: 'bg-amber-600',
    text: 'text-amber-600',
    border: 'border-amber-600',
    hover: 'hover:bg-amber-100',
    ring: 'focus:ring-amber-500',
    lightbg: 'bg-amber-50'
  },
  rose: {
    bg: 'bg-rose-600',
    text: 'text-rose-600',
    border: 'border-rose-600',
    hover: 'hover:bg-rose-100',
    ring: 'focus:ring-rose-500',
    lightbg: 'bg-rose-50'
  },
  sky: {
    bg: 'bg-sky-600',
    text: 'text-sky-600',
    border: 'border-sky-600',
    hover: 'hover:bg-sky-100',
    ring: 'focus:ring-sky-500',
    lightbg: 'bg-sky-50'
  },
  purple: {
    bg: 'bg-purple-600',
    text: 'text-purple-600',
    border: 'border-purple-600',
    hover: 'hover:bg-purple-100',
    ring: 'focus:ring-purple-500',
    lightbg: 'bg-purple-50'
  },
  teal: {
    bg: 'bg-teal-600',
    text: 'text-teal-600',
    border: 'border-teal-600',
    hover: 'hover:bg-teal-100',
    ring: 'focus:ring-teal-500',
    lightbg: 'bg-teal-50'
  },
  orange: {
    bg: 'bg-orange-600',
    text: 'text-orange-600',
    border: 'border-orange-600',
    hover: 'hover:bg-orange-100',
    ring: 'focus:ring-orange-500',
    lightbg: 'bg-orange-50'
  }
};
