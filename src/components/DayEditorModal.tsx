/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { X, Calendar, Edit3, RotateCcw, Clock, ShieldCheck } from 'lucide-react';
import { Employee, DayType, DayOverride } from '../types';
import { formatDate, getEmployeeDayStatus, getStandardHoursForDate } from '../utils';

interface DayEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  employee: Employee | null;
  date: Date | null;
  vacations: any[]; // VacationBooking[]
  onSaveOverride: (employeeId: string, dateStr: string, override: DayOverride | null) => void;
}

export const DayEditorModal: React.FC<DayEditorModalProps> = ({
  isOpen,
  onClose,
  employee,
  date,
  vacations,
  onSaveOverride,
}) => {
  const [selectedType, setSelectedType] = useState<DayType>('work');
  const [hours, setHours] = useState(10);

  // Load current day status when modal is loaded
  useEffect(() => {
    if (employee && date) {
      const dayInfo = getEmployeeDayStatus(employee, date, vacations);
      setSelectedType(dayInfo.type);
      setHours(dayInfo.hours);
    }
  }, [employee, date, vacations, isOpen]);

  if (!isOpen || !employee || !date) return null;

  const dateStr = formatDate(date);
  const formattedDateReadable = date.toLocaleDateString('ru-RU', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });

  const handleTypeChange = (type: DayType) => {
    setSelectedType(type);
    if (type === 'work') {
      // Restore standard hours for this day of week/season
      setHours(getStandardHoursForDate(date));
    } else {
      setHours(0); // Rest, sick or vacation starts with 0 hours, though sick/others can be custom-edited if paid
    }
  };

  const handleSave = () => {
    onSaveOverride(employee.id, dateStr, {
      type: selectedType,
      hours: Math.max(0, Math.min(24, hours)),
    });
    onClose();
  };

  const handleReset = () => {
    onSaveOverride(employee.id, dateStr, null); // passing null removes the override
    onClose();
  };

  // Determine standard baseline state for information
  const diffDays = Math.floor((date.getTime() - new Date(2026, 0, 1).getTime()) / (1000 * 60 * 60 * 24));
  const cycleIndex = (((diffDays + employee.startOffset) % 6) + 6) % 6;
  const isDefaultWork = cycleIndex >= 0 && cycleIndex <= 3;
  const defaultHours = isDefaultWork ? getStandardHoursForDate(date) : 0;

  return (
    <div id="day-editor-backdrop" className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
      <div id="day-editor-content" className="bg-white rounded-3xl w-full max-w-md shadow-2xl relative overflow-hidden flex flex-col p-6 animate-in zoom-in-95 duration-150">
        
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="space-y-1">
            <h3 id="day-editor-title" className="font-sans font-bold text-lg text-slate-800">
              Редактор смены ТК РФ
            </h3>
            <p className="text-xs text-slate-500 font-sans flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5 text-indigo-500" />
              {formattedDateReadable}
            </p>
          </div>
          <button
            id="close-day-editor-btn"
            onClick={onClose}
            className="p-1 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Employee display banner */}
        <div className="bg-slate-50 rounded-2xl p-3 mb-4 flex items-center justify-between border border-slate-100">
          <div>
            <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider font-sans">
              Сотрудник
            </span>
            <span className="text-sm font-semibold text-slate-700 block mt-0.5">
              {employee.name}
            </span>
            <span className="text-xs text-slate-500 font-sans block">{employee.position}</span>
          </div>
          <div className={`px-3 py-1 rounded-full text-xs font-semibold bg-${employee.color}-50 text-${employee.color}-600 capitalize`}>
            {employee.color}
          </div>
        </div>

        {/* Form elements */}
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 font-sans">
              Тип дня
            </label>
            <div className="grid grid-cols-2 gap-2" id="day-type-buttons">
              <button
                type="button"
                id="type-work-btn"
                onClick={() => handleTypeChange('work')}
                className={`py-2 px-3 rounded-xl text-xs font-semibold transition-all cursor-pointer flex flex-col items-center justify-center border ${
                  selectedType === 'work'
                    ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                    : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                <span>Рабочий</span>
                <span className="text-[10px] font-normal opacity-85">Смена ({getStandardHoursForDate(date)} ч.)</span>
              </button>

              <button
                type="button"
                id="type-rest-btn"
                onClick={() => handleTypeChange('rest')}
                className={`py-2 px-3 rounded-xl text-xs font-semibold transition-all cursor-pointer flex flex-col items-center justify-center border ${
                  selectedType === 'rest'
                    ? 'bg-slate-600 text-white border-slate-600 shadow-xs'
                    : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                <span>Выходной</span>
                <span className="text-[10px] font-normal opacity-85">Свободный день</span>
              </button>

              <button
                type="button"
                id="type-vacation-btn"
                onClick={() => handleTypeChange('vacation')}
                className={`py-2 px-3 rounded-xl text-xs font-semibold transition-all cursor-pointer flex flex-col items-center justify-center border ${
                  selectedType === 'vacation'
                    ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                    : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                <span>Отпускной</span>
                <span className="text-[10px] font-normal opacity-85">Vacation</span>
              </button>

              <button
                type="button"
                id="type-sick-btn"
                onClick={() => handleTypeChange('sick')}
                className={`py-2 px-3 rounded-xl text-xs font-semibold transition-all cursor-pointer flex flex-col items-center justify-center border ${
                  selectedType === 'sick'
                    ? 'bg-rose-600 text-white border-rose-600 shadow-xs'
                    : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                <span>Больничный</span>
                <span className="text-[10px] font-normal opacity-85">Sick Leave</span>
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5 font-sans flex justify-between">
              <span>Отработанные Часы</span>
            </label>
            <div className="relative">
              <input
                id="day-hours-input"
                type="number"
                min={0}
                max={24}
                value={hours}
                onChange={(e) => setHours(Math.max(0, parseInt(e.target.value) || 0))}
                className="w-full bg-slate-50 border border-slate-200 text-slate-800 text-sm rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-hidden p-3 font-mono"
                disabled={selectedType !== 'work' && selectedType !== 'sick'} // locked to 0 for rest/vacation unless edited
              />
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400">
                <Clock className="w-4 h-4" />
              </div>
            </div>
          </div>

          <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 text-xs text-slate-500 font-sans space-y-1">
            <h5 className="font-semibold text-slate-600">Системный расчетный статус:</h5>
            <p>Исходный сменный график: <span className="font-semibold text-slate-700">{isDefaultWork ? 'Рабочая смена' : 'Выходной день'}</span></p>
            <p>Исходные рабочие часы по норме: <span className="font-semibold text-slate-700">{defaultHours} ч.</span></p>
          </div>
        </div>

        {/* Actions footer */}
        <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between gap-3">
          <button
            id="day-reset-btn"
            onClick={handleReset}
            type="button"
            className="py-2.5 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 border border-slate-200/50 text-slate-600 text-xs font-medium transition-all flex items-center gap-1.5 cursor-pointer"
            title="Сбросить ручные изменения дня к стандартным"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Сброс к норме
          </button>
          
          <div className="flex gap-2">
            <button
              id="day-cancel-btn"
              onClick={onClose}
              type="button"
              className="py-2.5 px-4 rounded-xl hover:bg-slate-100 text-slate-600 text-xs font-medium transition-all cursor-pointer"
            >
              Отмена
            </button>
            <button
              id="day-save-btn"
              onClick={handleSave}
              type="button"
              className="py-2.5 px-5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-all cursor-pointer shadow-xs"
            >
              Сохранить
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
