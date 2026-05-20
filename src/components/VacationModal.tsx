/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { X, Calendar, User, HelpCircle, ArrowRight, Trash2, ShieldCheck, Sun } from 'lucide-react';
import { Employee, VacationBooking } from '../types';
import { calculateVacationDays, formatDate, isRussianHoliday, parseDate } from '../utils';

interface VacationModalProps {
  isOpen: boolean;
  onClose: () => void;
  employees: Employee[];
  vacations: VacationBooking[];
  onAddVacation: (vacation: Omit<VacationBooking, 'id'>) => void;
  onDeleteVacation: (id: string) => void;
}

export const VacationModal: React.FC<VacationModalProps> = ({
  isOpen,
  onClose,
  employees,
  vacations,
  onAddVacation,
  onDeleteVacation,
}) => {
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('');
  const [startDateStr, setStartDateStr] = useState(formatDate(new Date()));
  const [daysRequested, setDaysRequested] = useState(14);
  
  // Real-time calculation state
  const [calculatedEnd, setCalculatedEnd] = useState('');
  const [holidaysDetected, setHolidaysDetected] = useState<string[]>([]);
  const [totalCalendarDays, setTotalCalendarDays] = useState(14);

  useEffect(() => {
    if (employees.length > 0 && !selectedEmployeeId) {
      setSelectedEmployeeId(employees[0].id);
    }
  }, [employees, selectedEmployeeId]);

  // Recalculate whenever inputs change
  useEffect(() => {
    if (!startDateStr || daysRequested <= 0) return;
    try {
      const { endDateStr, holidaysIncluded } = calculateVacationDays(startDateStr, daysRequested);
      setCalculatedEnd(endDateStr);
      setHolidaysDetected(holidaysIncluded);

      const startD = parseDate(startDateStr);
      const endD = parseDate(endDateStr);
      const calendarDays = Math.round((endD.getTime() - startD.getTime()) / (1000 * 60 * 60 * 24)) + 1;
      setTotalCalendarDays(calendarDays);
    } catch (e) {
      console.error(e);
    }
  }, [startDateStr, daysRequested]);

  if (!isOpen) return null;

  const selectedEmployee = employees.find(e => e.id === selectedEmployeeId);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEmployeeId || !startDateStr || daysRequested <= 0) return;

    onAddVacation({
      employeeId: selectedEmployeeId,
      startDate: startDateStr,
      daysRequested,
      endDate: calculatedEnd,
      holidaysIncluded: holidaysDetected,
    });
    
    // Toast-like message or simply reset partly
    setDaysRequested(14);
  };

  const getHolidayName = (dateStr: string): string => {
    const [, m, d] = dateStr.split('-');
    const mmdd = `${m}-${d}`;
    switch (mmdd) {
      case '01-01': case '01-02': case '01-03': case '01-04': case '01-05': case '01-06': case '01-08':
        return 'Новогодние каникулы';
      case '01-07':
        return 'Рождество Христово';
      case '02-23':
        return 'День защитника Отечества';
      case '03-08':
        return 'Международный женский день';
      case '05-01':
        return 'Праздник Весны и Труда';
      case '05-09':
        return 'День Победы';
      case '06-12':
        return 'День России';
      case '11-04':
        return 'День народного единства';
      default:
        return 'Государственный праздник';
    }
  };

  const formatDateReadable = (dateStr: string) => {
    if (!dateStr) return '';
    const d = parseDate(dateStr);
    return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
  };

  return (
    <div id="vacation-modal-backdrop" className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 transition-opacity duration-300">
      <div id="vacation-modal-content" className="bg-white rounded-3xl w-full max-w-3xl shadow-2xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in duration-250">
        
        {/* Header */}
        <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-indigo-50/50">
          <div>
            <h3 id="vacation-modal-title" className="font-sans font-bold text-lg text-slate-800 flex items-center gap-2">
              <Sun className="w-5 h-5 text-amber-500 fill-amber-100" />
              Калькулятор ежегодных отпусков (ст. 120 ТК РФ)
            </h3>
            <p className="text-xs text-slate-500 mt-1 font-sans">
              Нерабочие праздничные дни в число календарных дней отпуска не включаются и не оплачиваются.
            </p>
          </div>
          <button
            id="close-vacation-modal-btn"
            onClick={onClose}
            className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content body split in columns */}
        <div className="flex-1 overflow-y-auto p-6 grid grid-cols-1 md:grid-cols-12 gap-6">
          
          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4 md:col-span-7">
            <div id="vacation-form-section">
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5 font-sans">
                Сотрудник
              </label>
              <div className="relative">
                <select
                  id="vacation-employee-select"
                  value={selectedEmployeeId}
                  onChange={(e) => setSelectedEmployeeId(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 text-slate-800 text-sm rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-hidden p-3 appearance-none font-sans"
                  required
                >
                  <option value="" disabled>Выберите сотрудника...</option>
                  {employees.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.name} ({emp.position})
                    </option>
                  ))}
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-slate-400">
                  <User className="w-4 h-4" />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5 font-sans">
                  Дата начала
                </label>
                <input
                  id="vacation-start-date"
                  type="date"
                  value={startDateStr}
                  onChange={(e) => setStartDateStr(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 text-slate-800 text-sm rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-hidden p-3 font-mono"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5 font-sans">
                  Количество дней
                </label>
                <input
                  id="vacation-days-qty"
                  type="number"
                  min={1}
                  max={60}
                  value={daysRequested}
                  onChange={(e) => setDaysRequested(Math.max(1, parseInt(e.target.value) || 0))}
                  className="w-full bg-slate-50 border border-slate-200 text-slate-800 text-sm rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-hidden p-3 font-mono"
                  required
                />
              </div>
            </div>

            {/* Calculations Breakdown Box */}
            <div className="bg-indigo-50/40 rounded-2xl p-4 border border-indigo-100/60 font-sans">
              <h4 className="text-xs font-bold text-indigo-700 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-indigo-600" />
                Результаты расчета по ТК РФ:
              </h4>

              <div className="space-y-2 text-sm text-slate-700">
                <div className="flex items-center justify-between py-1.5 border-b border-indigo-100/30">
                  <span className="text-slate-500">Начало отпуска:</span>
                  <span className="font-semibold text-slate-800">{formatDateReadable(startDateStr)}</span>
                </div>
                
                <div className="flex items-center justify-between py-1.5 border-b border-indigo-100/30">
                  <span className="text-slate-500">Оплачиваемые дни:</span>
                  <span className="font-bold text-indigo-700">{daysRequested} дн.</span>
                </div>

                <div className="flex items-center justify-between py-1.5 border-b border-indigo-100/30">
                  <span className="text-slate-500 flex items-center gap-1">
                    Праздничные дни (исключены):
                    <span className="group relative cursor-help">
                      <HelpCircle className="w-3.5 h-3.5 text-slate-400 hover:text-indigo-600" />
                      <span className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 w-48 bg-slate-800 text-white text-[10px] p-2 rounded-lg opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity z-10 leading-normal">
                        Гос. праздники продлевают физическую длительность отпуска без расхода лимита дней.
                      </span>
                    </span>
                  </span>
                  <span className="font-semibold text-amber-600">
                    +{holidaysDetected.length} {holidaysDetected.length === 1 ? 'день' : holidaysDetected.length >= 2 && holidaysDetected.length <= 4 ? 'дня' : 'дней'}
                  </span>
                </div>

                {holidaysDetected.length > 0 && (
                  <div className="bg-white/80 p-2.5 rounded-lg border border-slate-100 text-xs text-amber-700 space-y-1 my-2">
                    <p className="font-semibold">Перечень праздников в периоде:</p>
                    <ul className="list-disc list-inside space-y-0.5">
                      {holidaysDetected.map((hDate) => (
                        <li key={hDate}>
                          <span className="font-mono">{formatDateReadable(hDate)}</span> — {getHolidayName(hDate)}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <div className="flex items-center justify-between py-1.5 border-b border-indigo-100/30">
                  <span className="text-slate-500">Физическая длительность:</span>
                  <span className="font-semibold text-slate-800 font-mono">{totalCalendarDays} календарных дней</span>
                </div>

                <div className="flex items-center justify-between pt-1.5">
                  <span className="text-slate-500">Последний день отпуска:</span>
                  <span className="font-bold text-slate-800 flex items-center gap-1">
                    {formatDateReadable(calculatedEnd)}
                  </span>
                </div>
              </div>
            </div>

            <button
              id="vacation-add-submit"
              type="submit"
              className="w-full bg-indigo-600 hover:bg-indigo-700 active:scale-98 text-white font-sans font-semibold py-3 px-4 rounded-xl transition-all cursor-pointer flex items-center justify-center gap-2 text-sm shadow-xs"
            >
              Зарегистрировать отпуск в графике
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          {/* List of current booked vacations */}
          <div className="md:col-span-5 flex flex-col">
            <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3 font-sans">
              Активные отпуска в системе
            </h4>
            
            {vacations.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center border-2 border-dashed border-slate-100 rounded-2xl p-6 text-slate-400 bg-slate-50/50">
                <Calendar className="w-10 h-10 text-slate-300 mb-2 stroke-1" />
                <p className="text-xs font-sans text-center">Зарегистрированных отпусков не обнаружено.</p>
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto max-h-[360px] space-y-3 pr-1">
                {vacations.map((vac) => {
                  const empObj = employees.find(e => e.id === vac.employeeId);
                  return (
                    <div
                      key={vac.id}
                      className="bg-slate-50/80 border border-slate-100 hover:border-slate-200 rounded-xl p-3 flex items-start justify-between group transition-colors"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-1.5">
                          <span className={`w-2.5 h-2.5 rounded-full ${empObj ? `bg-${empObj.color}-600` : 'bg-slate-400'}`}></span>
                          <span className="text-sm font-semibold text-slate-800">
                            {empObj ? empObj.name : 'Неизвестный сотрудник'}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 font-sans">
                          {formatDateReadable(vac.startDate)} — {formatDateReadable(vac.endDate)}
                        </p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="inline-block bg-slate-200/60 text-slate-700 font-mono text-[10px] px-1.5 py-0.5 rounded">
                            {vac.daysRequested} раб. дней отпуска
                          </span>
                          {vac.holidaysIncluded.length > 0 && (
                            <span className="inline-block bg-amber-50 text-amber-700 font-mono text-[10px] px-1.5 py-0.5 rounded">
                              +{vac.holidaysIncluded.length} празд.
                            </span>
                          )}
                        </div>
                      </div>

                      <button
                        id={`delete-vacation-${vac.id}`}
                        onClick={() => onDeleteVacation(vac.id)}
                        className="p-1.5 text-slate-300 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                        title="Удалить бронь отпуска"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

        </div>

      </div>
    </div>
  );
};
