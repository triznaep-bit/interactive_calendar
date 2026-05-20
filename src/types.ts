/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type DayType = 'work' | 'rest' | 'vacation' | 'sick';

export interface DayOverride {
  type: DayType;
  hours: number;
}

export type EmployeeStatusType = 
  | 'active'                       // Активен / Работает
  | 'fired'                        // Уволен
  | 'transferred_out'              // Убыл на другую точку
  | 'transferred_in'               // Вернулся на точку
  | 'reemployed';                  // Снова трудоустроен

export interface StatusHistoryRecord {
  id: string;
  date: string;                   // YYYY-MM-DD с какой даты применяется статус
  status: EmployeeStatusType;
  note?: string;                  // Дополнительные примечания
  timestamp: number;              // Время совершения операции
}

export interface Employee {
  id: string;
  name: string;
  position: string;
  color: string;                  // Tailwind color class name prefix
  startOffset: number;            // 0-5 offset for the 4/2 schedule cycle
  dateOverrides: Record<string, DayOverride>; // Key: YYYY-MM-DD
  phone?: string;                 // Номер телефона сотрудника
  birthDate?: string;             // Дата рождения сотрудника (YYYY-MM-DD)
  statusHistory?: StatusHistoryRecord[]; // История изменения статусов сотрудника
  hireDate?: string;              // Дата трудоустройства сотрудника (YYYY-MM-DD)
}

export interface VacationBooking {
  id: string;
  employeeId: string;
  startDate: string; // YYYY-MM-DD
  daysRequested: number; // Count of paid vacation days (excluding national holidays)
  endDate: string; // YYYY-MM-DD physical end date
  holidaysIncluded: string[]; // List of YYYY-MM-DD holidays inside the period
}

export interface ShopDetails {
  id: string;
  name: string;
  category: string;
  address: string;
  operatingSince: string;
}

export interface MonthStats {
  workDays: number;
  workHours: number;
  restDays: number;
  vacationDays: number; // Paid days
  vacationCalendarDays: number; // Total physical days
  sickDays: number;
  sickHours: number;
}
