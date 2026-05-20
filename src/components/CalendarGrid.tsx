/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Calendar, ChevronLeft, ChevronRight, AlertTriangle, ShieldCheck, Sun, Pill, Gift, Landmark, Check } from 'lucide-react';
import { motion } from 'motion/react';
import { Employee, VacationBooking, DayType, DayOverride } from '../types';
import { getEmployeeDayStatus, isRussianHoliday, TAILWIND_COLORS, parseDate, formatDate, getEmployeeStatusOnDate } from '../utils';
import { getShiftedPaymentDate } from '../utils/paymentUtils';

interface CalendarGridProps {
  year: number;
  monthIndex: number;
  onMonthChange: (year: number, monthIdx: number) => void;
  employees: Employee[];
  vacations: VacationBooking[];
  onSelectDay: (employee: Employee, date: Date) => void;
  filterStartDateStr: string;
  filterEndDateStr: string;
  isRangeFilterActive: boolean;
  onToggleRangeFilter: (active: boolean) => void;
  onRangeFilterChange: (start: string, end: string) => void;
  renderBirthdayPanel?: () => React.ReactNode;
}

export const CalendarGrid: React.FC<CalendarGridProps> = ({
  year,
  monthIndex,
  onMonthChange,
  employees,
  vacations,
  onSelectDay,
  filterStartDateStr,
  filterEndDateStr,
  isRangeFilterActive,
  onToggleRangeFilter,
  onRangeFilterChange,
  renderBirthdayPanel,
}) => {
  const monthNamesRu = [
    'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
    'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'
  ];

  const weekDaysRu = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

  // 1. Navigation handlers
  const handlePrevMonth = () => {
    if (monthIndex === 0) {
      onMonthChange(year - 1, 11);
    } else {
      onMonthChange(year, monthIndex - 1);
    }
  };

  const handleNextMonth = () => {
    if (monthIndex === 11) {
      onMonthChange(year + 1, 0);
    } else {
      onMonthChange(year, monthIndex + 1);
    }
  };

  // 2. Generate days grid
  const cells: { date: Date; isCurrentMonth: boolean; isHoliday: boolean; dayNumber: number; isOutsideRangeFilter?: boolean }[] = [];

  if (isRangeFilterActive) {
    try {
      const filterStart = parseDate(filterStartDateStr);
      const filterEnd = parseDate(filterEndDateStr);

      const start = new Date(filterStart.getTime());
      const day = start.getDay();
      const diffToMonday = (day === 0 ? -6 : 1 - day);
      const paddedStart = new Date(start.getTime());
      paddedStart.setDate(start.getDate() + diffToMonday);

      const end = new Date(filterEnd.getTime());
      const endDay = end.getDay();
      const diffToSunday = (endDay === 0 ? 0 : 7 - endDay);
      const paddedEnd = new Date(end.getTime());
      paddedEnd.setDate(end.getDate() + diffToSunday);

      let current = new Date(paddedStart.getTime());
      while (current.getTime() <= paddedEnd.getTime()) {
        const isOutside = current.getTime() < filterStart.getTime() || current.getTime() > filterEnd.getTime();
        cells.push({
          date: new Date(current.getTime()),
          isCurrentMonth: !isOutside,
          isHoliday: isRussianHoliday(current),
          dayNumber: current.getDate(),
          isOutsideRangeFilter: isOutside,
        });
        current.setDate(current.getDate() + 1);
      }
    } catch (e) {
      console.error('Failed to parse date range filter:', e);
    }
  } else {
    const firstDay = new Date(year, monthIndex, 1);
    const startDayOfWeek = (firstDay.getDay() + 6) % 7;
    const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();

    const prevMonthYear = monthIndex === 0 ? year - 1 : year;
    const prevMonthIdx = monthIndex === 0 ? 11 : monthIndex - 1;
    const daysInPrevMonth = new Date(prevMonthYear, prevMonthIdx + 1, 0).getDate();

    for (let i = startDayOfWeek - 1; i >= 0; i--) {
      const d = new Date(prevMonthYear, prevMonthIdx, daysInPrevMonth - i);
      cells.push({
        date: d,
        isCurrentMonth: false,
        isHoliday: isRussianHoliday(d),
        dayNumber: d.getDate(),
      });
    }

    for (let d = 1; d <= daysInMonth; d++) {
      const date = new Date(year, monthIndex, d);
      cells.push({
        date,
        isCurrentMonth: true,
        isHoliday: isRussianHoliday(date),
        dayNumber: d,
      });
    }

    const nextMonthYear = monthIndex === 11 ? year + 1 : year;
    const nextMonthIdx = monthIndex === 11 ? 0 : monthIndex + 1;
    const remainingCells = (7 - (cells.length % 7)) % 7;
    for (let d = 1; d <= remainingCells; d++) {
      const date = new Date(nextMonthYear, nextMonthIdx, d);
      cells.push({
        date,
        isCurrentMonth: false,
        isHoliday: isRussianHoliday(date),
        dayNumber: d,
      });
    }
  }

  // Quick helper to read readable label for Day Type
  const getDayTypeLabel = (type: DayType, hours: number) => {
    switch (type) {
      case 'work':
        return `${hours} ч.`;
      case 'rest':
        return 'Вых';
      case 'vacation':
        return 'Отп';
      case 'sick':
        return 'Бол';
    }
  };

  // Styles per type
  const getDayTypeStyles = (type: DayType) => {
    switch (type) {
      case 'work':
        return 'bg-blue-50 text-blue-800 border-blue-200/60';
      case 'rest':
        return 'bg-slate-50 text-slate-450 border-slate-200/40 text-slate-400';
      case 'vacation':
        return 'bg-emerald-50 text-emerald-800 border-emerald-200/80';
      case 'sick':
        return 'bg-rose-50 text-rose-800 border-rose-200/80';
    }
  };

  return (
    <div id="calendar-grid-section" className="bg-white rounded-3xl border border-slate-100 shadow-xs overflow-hidden flex flex-col">
      
      {/* Calendar Controller Header */}
      <div className="p-6 border-b border-slate-150 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-slate-50/55 select-none">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-indigo-600 rounded-xl text-white">
            <Calendar className="w-5 h-5" />
          </div>
          <div>
            <h3 id="calendar-title" className="font-sans font-extrabold text-lg text-slate-800 leading-tight">
              График смен персонала
            </h3>
            <p className="text-xs text-slate-500 font-sans mt-0.5">
              Интерактивная сетка. Кликните на ячейку сотрудника для ручной корректировки.
            </p>
          </div>
        </div>

        {/* Action controls & indicators */}
        <div className="flex flex-col items-end gap-2.5 self-end sm:self-auto shrink-0">
          {/* Birthday Panel Injection */}
          {renderBirthdayPanel && renderBirthdayPanel()}

          <div className="flex items-center gap-4 flex-wrap sm:flex-nowrap">
            {/* Legend indicator */}
            <div className="hidden lg:flex items-center gap-3.5 text-[11px] font-sans text-slate-500">
              <div className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded bg-blue-100 border border-blue-300 block"></span>
                <span>Работа</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded bg-slate-100 border border-slate-200 block"></span>
                <span>Выходной</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded bg-emerald-100 border border-emerald-300 block"></span>
                <span>Отпуск</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded bg-rose-100 border border-rose-300 block"></span>
                <span>Больничный</span>
              </div>
            </div>

            <div className="flex items-center gap-1.5 bg-white border border-slate-200/80 rounded-xl p-1 shadow-2xs">
              <button
                id="prev-month-btn"
                onClick={handlePrevMonth}
                className="p-1.5 hover:bg-slate-50 text-slate-600 hover:text-indigo-600 rounded-lg transition-colors cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              
              <div className="px-3 text-center min-w-[130px] font-sans">
                <span className="font-bold text-slate-800 text-sm block">
                  {monthNamesRu[monthIndex]}
                </span>
                <span className="text-[10px] text-slate-400 block font-mono">
                  {year} год
                </span>
              </div>

              <button
                id="next-month-btn"
                onClick={handleNextMonth}
                className="p-1.5 hover:bg-slate-50 text-slate-600 hover:text-indigo-600 rounded-lg transition-colors cursor-pointer"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Date Range Filter Control Panel */}
      <div id="date-range-filter-panel" className="px-6 py-4 bg-indigo-50/25 border-b border-slate-100 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <label className="flex items-center gap-2 cursor-pointer font-sans text-sm font-semibold text-slate-700">
            <input
              id="toggle-range-filter-cb"
              type="checkbox"
              checked={isRangeFilterActive}
              onChange={(e) => onToggleRangeFilter(e.target.checked)}
              className="w-4.5 h-4.5 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500 checked:bg-indigo-600 cursor-pointer"
            />
            <span>Фильтр по произвольному периоду</span>
          </label>
          
          {isRangeFilterActive && (
            <span className="text-[10px] bg-indigo-100/80 text-indigo-700 font-bold px-2 py-0.5 rounded-full font-sans uppercase tracking-wider">
              Режим фильтрации активен
            </span>
          )}
        </div>

        {/* Selected period inputs */}
        <div className="flex flex-wrap items-center gap-3.5">
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500 font-semibold font-sans">С:</span>
            <input
              id="filter-start-date-input"
              type="date"
              value={filterStartDateStr}
              onChange={(e) => onRangeFilterChange(e.target.value, filterEndDateStr)}
              className={`text-xs p-2 bg-white border rounded-xl font-mono focus:ring-1 focus:ring-indigo-500 focus:outline-hidden ${
                isRangeFilterActive ? 'border-indigo-400 text-slate-800 ring-2 ring-indigo-100/50' : 'border-slate-200 text-slate-400 bg-slate-50'
              }`}
              disabled={!isRangeFilterActive}
            />
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500 font-semibold font-sans">по:</span>
            <input
              id="filter-end-date-input"
              type="date"
              value={filterEndDateStr}
              onChange={(e) => onRangeFilterChange(filterStartDateStr, e.target.value)}
              className={`text-xs p-2 bg-white border rounded-xl font-mono focus:ring-1 focus:ring-indigo-500 focus:outline-hidden ${
                isRangeFilterActive ? 'border-indigo-400 text-slate-800 ring-2 ring-indigo-100/50' : 'border-slate-200 text-slate-400 bg-slate-50'
              }`}
              disabled={!isRangeFilterActive}
            />
          </div>

          {/* Presets */}
          {isRangeFilterActive && (
            <div className="flex gap-1">
              <button
                type="button"
                id="preset-this-month"
                onClick={() => {
                  const first = formatDate(new Date(year, monthIndex, 1));
                  const last = formatDate(new Date(year, monthIndex + 1, 0));
                  onRangeFilterChange(first, last);
                }}
                className="text-[10px] font-sans font-bold text-indigo-600 hover:text-white hover:bg-indigo-600 bg-white border border-indigo-200 px-2 py-1.5 rounded-lg transition-all cursor-pointer"
                title="Сбросить границы фильтра к текущему рассматриваемому месяцу"
              >
                Этот месяц
              </button>

              <button
                type="button"
                id="preset-summer-period"
                onClick={() => {
                  const first = `${year}-04-01`;
                  const last = `${year}-09-30`;
                  onRangeFilterChange(first, last);
                }}
                className="text-[10px] font-sans font-bold text-amber-700 hover:text-white hover:bg-amber-600 bg-white border border-amber-200 px-2 py-1.5 rounded-lg transition-all cursor-pointer"
                title="Установить летний регулируемый период ТК РФ (с 1 апреля по 30 сентября)"
              >
                Лето ({year})
              </button>

              <button
                type="button"
                id="preset-winter-period"
                onClick={() => {
                  const first = `${year}-10-01`;
                  const last = `${year + 1}-03-31`;
                  onRangeFilterChange(first, last);
                }}
                className="text-[10px] font-sans font-bold text-sky-700 hover:text-white hover:bg-sky-600 bg-white border border-sky-200 px-2 py-1.5 rounded-lg transition-all cursor-pointer"
                title="Установить зимний период ТК РФ (с 1 октября по 31 марта)"
              >
                Зима ({year})
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Actual Calendar Grid */}
      <div className="p-4 overflow-x-auto">
        <div className="min-w-[700px]">
          {/* Day Headers row */}
          <div className="grid grid-cols-7 gap-1 text-center font-bold text-xs uppercase text-slate-400 tracking-wider mb-2 font-sans py-1.5 border-b border-slate-50">
            {weekDaysRu.map((day, idx) => (
              <div key={day} className={idx >= 5 ? 'text-amber-600' : 'text-slate-400'}>
                {day}
              </div>
            ))}
          </div>

          {/* Cells grid with subtle entry/transition animation */}
          <motion.div
            key={`${year}-${monthIndex}-${isRangeFilterActive}-${filterStartDateStr}-${filterEndDateStr}`}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, ease: 'easeOut' }}
            className="grid grid-cols-7 gap-1.5"
            id="calendar-cells-grid"
          >
            {cells.map((cell, cIdx) => {
              const cellDateStr = cell.date.toDateString();
              
              // Calculate daily work parameters
              let onDutyEmployees: { employee: Employee; status: any }[] = [];
              let totalWorkCountInstance = 0;

              employees.forEach((emp) => {
                if (emp.hireDate && formatDate(cell.date) < emp.hireDate) {
                  return; // Skip employee before their hiring date
                }
                const empStatusOnDate = getEmployeeStatusOnDate(emp, cell.date);
                if (empStatusOnDate === 'fired' || empStatusOnDate === 'transferred_out') {
                  return; // Skip employee on this calendar date starting from termination/transfer
                }
                const dayStatus = getEmployeeDayStatus(emp, cell.date, vacations);
                if (dayStatus.type === 'work') {
                  totalWorkCountInstance++;
                }
                onDutyEmployees.push({
                  employee: emp,
                  status: dayStatus,
                });
              });

              // Indicators for daily workload
              const isWeekendDay = cell.date.getDay() === 0 || cell.date.getDay() === 6;

              // Calculate Shifted Payment Dates for the cell's month/year
              const currentMonthYear = cell.date.getFullYear();
              const currentMonthIndex = cell.date.getMonth();
              const salaryShifted = getShiftedPaymentDate(currentMonthYear, currentMonthIndex, 10);
              const advanceShifted = getShiftedPaymentDate(currentMonthYear, currentMonthIndex, 25);
              
              const isSalaryDay = cell.date.getDate() === salaryShifted.getDate() && cell.date.getMonth() === salaryShifted.getMonth() && cell.date.getFullYear() === salaryShifted.getFullYear();
              const isAdvanceDay = cell.date.getDate() === advanceShifted.getDate() && cell.date.getMonth() === advanceShifted.getMonth() && cell.date.getFullYear() === advanceShifted.getFullYear();

              // Detect birthdays in cell date
              const birthdayStaff = employees.filter((emp) => {
                if (emp.hireDate && formatDate(cell.date) < emp.hireDate) {
                  return false;
                }
                const empStatusOnDate = getEmployeeStatusOnDate(emp, cell.date);
                if (empStatusOnDate === 'fired' || empStatusOnDate === 'transferred_out') {
                  return false;
                }
                if (!emp.birthDate) return false;
                const [, bMonth, bDay] = emp.birthDate.split('-').map(Number);
                return cell.date.getDate() === bDay && (cell.date.getMonth() + 1) === bMonth;
              });

              return (
                <motion.div
                  key={cIdx}
                  layout="position"
                  id={`day-cell-${cell.date.getFullYear()}-${cell.date.getMonth()}-${cell.date.getDate()}`}
                  className={`min-h-[140px] rounded-2xl border transition-all flex flex-col p-2.5 ${
                    cell.isOutsideRangeFilter
                      ? 'bg-slate-50 border-slate-200 border-dashed opacity-40 select-none'
                      : cell.isCurrentMonth
                      ? totalWorkCountInstance === 0
                        ? 'bg-rose-50/70 border-rose-500 shadow-xs ring-2 ring-rose-200/50'
                        : 'bg-white border-slate-100 hover:border-slate-350 hover:shadow-xs'
                      : 'bg-slate-50/40 border-slate-100/30 opacity-70'
                  } ${cell.isHoliday && !cell.isOutsideRangeFilter && totalWorkCountInstance > 0 ? 'bg-red-50/20 border-red-100' : ''}`}
                >
                  {/* Top bar: date number & special tags */}
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-1">
                      <span
                        className={`text-xs font-mono font-bold px-1.5 py-0.5 rounded-lg flex items-center gap-0.5 ${
                          cell.isHoliday && !cell.isOutsideRangeFilter
                            ? 'bg-red-500 text-white shadow-3xs'
                            : isWeekendDay && cell.isCurrentMonth
                            ? 'bg-amber-100 text-amber-800'
                            : cell.isCurrentMonth
                            ? 'text-slate-800 bg-slate-50'
                            : 'text-slate-350 bg-slate-50/50'
                        }`}
                        title={cell.isHoliday ? 'Государственный праздник РФ' : ''}
                      >
                        {cell.dayNumber}
                        {cell.isHoliday && !cell.isOutsideRangeFilter && <span className="text-[9px] text-white">★</span>}
                      </span>

                      {/* Paydays label */}
                      {cell.isCurrentMonth && !cell.isOutsideRangeFilter && isSalaryDay && (
                        <span 
                          className="bg-emerald-100 text-emerald-800 p-1 rounded-md text-[9px] font-extrabold inline-flex items-center gap-0.5 animate-bounce shadow-3xs" 
                          title="Выплата заработной платы (ТК РФ: ст. 136)"
                        >
                          <Landmark className="w-2.5 h-2.5 text-emerald-600" />
                          ЗП
                        </span>
                      )}
                      {cell.isCurrentMonth && !cell.isOutsideRangeFilter && isAdvanceDay && (
                        <span 
                          className="bg-indigo-100 text-indigo-800 p-1 rounded-md text-[9px] font-extrabold inline-flex items-center gap-0.5 animate-bounce shadow-3xs" 
                          title="Выплата аванса (ТК РФ: ст. 136)"
                        >
                          <Landmark className="w-2.5 h-2.5 text-indigo-600" />
                          АВ
                        </span>
                      )}
                    </div>
                    
                    {/* Work Pair safety status banner (wants exactly 2 people working) */}
                    {cell.isCurrentMonth && !cell.isOutsideRangeFilter && (
                      <div className="flex items-center gap-1">
                        {birthdayStaff.length > 0 && (
                          <span
                            className="bg-purple-100 text-purple-700 p-0.5 rounded animate-bounce"
                            title={`День рождения: ${birthdayStaff.map(s => s.name).join(', ')}`}
                          >
                            <Gift className="w-3 h-3" />
                          </span>
                        )}

                        <motion.div
                          key={totalWorkCountInstance}
                          initial={{ scale: 0.8, opacity: 0 }}
                          animate={{ scale: 1, opacity: 1 }}
                          transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                        >
                          {totalWorkCountInstance === 2 ? (
                            <span className="text-[9px] px-1 bg-emerald-50 text-emerald-700 rounded-sm font-semibold flex items-center gap-0.5" title="Норма смены: ровно 2 чел.">
                              <ShieldCheck className="w-2.5 h-2.5" />
                              2 чел
                            </span>
                          ) : totalWorkCountInstance === 1 ? (
                            <span className="text-[9px] px-1 bg-amber-50 text-amber-700 rounded-sm font-semibold flex items-center gap-0.5" title="Кадровый дефицит! Работает 1 человек (отпуск/больничный)">
                              <AlertTriangle className="w-2.5 h-2.5" />
                              1 чел
                            </span>
                          ) : totalWorkCountInstance === 0 ? (
                            <span className="text-[9px] px-1 bg-rose-50 text-rose-700 rounded-sm font-semibold flex items-center gap-0.5" title="Критическая ситуация! В магазине никто не работает">
                              <AlertTriangle className="w-2.5 h-2.5 fill-rose-100" />
                              0 чел
                            </span>
                          ) : (
                            <span className="text-[9px] px-1 bg-blue-50 text-blue-700 rounded-sm font-semibold flex items-center gap-0.5" title="Избыток смены! На работе более 2 человек">
                              <AlertTriangle className="w-2.5 h-2.5" />
                              {totalWorkCountInstance} чел
                            </span>
                          )}
                        </motion.div>
                      </div>
                    )}
                  </div>
 
                  {/* Employee day-status capsules list */}
                  <div className="space-y-1 flex-1">
                    {onDutyEmployees.map(({ employee, status }) => {
                      const colorSet = TAILWIND_COLORS[employee.color] || TAILWIND_COLORS.indigo;
                      const customStyles = getDayTypeStyles(status.type);
 
                      return (
                        <motion.button
                          key={employee.id}
                          layoutId={`cell-${employee.id}-${cellDateStr}`}
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          id={`cell-btn-${employee.id}-${formatDate(cell.date)}`}
                          onClick={() => {
                            if (!cell.isOutsideRangeFilter) {
                              onSelectDay(employee, cell.date);
                            }
                          }}
                          disabled={cell.isOutsideRangeFilter}
                          className={`w-full text-left p-1.5 rounded-lg border text-[10px] font-medium leading-none flex items-center justify-between ${
                            cell.isOutsideRangeFilter 
                              ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed'
                              : `cursor-pointer transition-colors ${customStyles}`
                          }`}
                          title={cell.isOutsideRangeFilter ? 'Вне диапазона фильтрации' : `Нажмите, чтобы изменить смену для ${employee.name}`}
                        >
                          <div className="flex items-center gap-1 truncate max-w-[70%]">
                            {/* colored dot indicator */}
                            <span className={`w-1.5 h-1.5 rounded-full ${colorSet.bg}`}></span>
                            <span className="truncate font-sans font-semibold text-slate-700">
                              {employee.name.split(' ')[0]}
                            </span>
                          </div>
 
                          <div className="flex items-center gap-1 font-mono">
                            <motion.span
                              key={`${status.type}-${status.hours}`}
                              initial={{ scale: 0.8, opacity: 0 }}
                              animate={{ scale: 1, opacity: 1 }}
                              className="font-bold font-mono"
                            >
                              {getDayTypeLabel(status.type, status.hours)}
                            </motion.span>
                            {/* override modifier dot */}
                            {status.isOverridden && !cell.isOutsideRangeFilter && (
                              <span
                                className="w-1 h-1 rounded-full bg-indigo-600 animate-pulse"
                                title="Изменено вручную"
                              />
                            )}
                          </div>
                        </motion.button>
                      );
                    })}
                  </div>
                </motion.div>
              );
            })}
          </motion.div>
        </div>
      </div>

    </div>
  );
};
