/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Settings, RotateCcw, Undo2, Smile } from 'lucide-react';
import { Employee, DayOverride } from '../types';
import { TAILWIND_COLORS } from '../utils';

interface OverridesManagerProps {
  employees: Employee[];
  year: number;
  monthIndex: number;
  onSaveMultipleOverrides?: (employeeId: string, overrides: Record<string, DayOverride | null>) => void;
  onResetAllEmployees?: () => void;
  // State from parent to keep in sync
  selectedResetEmpId: string;
  setSelectedResetEmpId: (id: string) => void;
  totalOverridesToReset: number;
  isBulkConfirmOpen: boolean;
  setIsBulkConfirmOpen: (open: boolean) => void;
  onBulkReset: () => void;
  onUndoBulkReset: () => void;
  bulkResetBackup: any;
}

export const OverridesManager: React.FC<OverridesManagerProps> = ({
  employees,
  year,
  monthIndex,
  onSaveMultipleOverrides,
  selectedResetEmpId,
  setSelectedResetEmpId,
  totalOverridesToReset,
  isBulkConfirmOpen,
  setIsBulkConfirmOpen,
  onBulkReset,
  onUndoBulkReset,
  bulkResetBackup,
}) => {
  const [activeTab, setActiveTab] = useState<'stats' | 'registry'>('stats');
  const currentMonthPrefix = `${year}-${String(monthIndex + 1).padStart(2, '0')}-`;

  // Collect overrides for this month
  const activeMonthOverrides: Array<{
    empId: string;
    empName: string;
    empColor: string;
    dateStr: string;
    dayNumber: number;
    override: DayOverride;
  }> = [];

  employees.forEach((emp) => {
    if (emp.dateOverrides) {
      Object.keys(emp.dateOverrides).forEach((dateStr) => {
        if (dateStr.startsWith(currentMonthPrefix)) {
          const override = emp.dateOverrides[dateStr];
          if (override) {
            const dayNumber = parseInt(dateStr.split('-')[2]) || 0;
            activeMonthOverrides.push({
              empId: emp.id,
              empName: emp.name,
              empColor: emp.color,
              dateStr,
              dayNumber,
              override,
            });
          }
        }
      });
    }
  });

  activeMonthOverrides.sort((a, b) => a.dayNumber - b.dayNumber);

  const handleDeleteSingleOverride = (empId: string, dateStr: string) => {
    if (onSaveMultipleOverrides) {
      onSaveMultipleOverrides(empId, { [dateStr]: null });
    }
  };

  const handleResetSingleEmployeeOverrides = (empId: string) => {
    if (!onSaveMultipleOverrides) return;
    const targetEmp = employees.find(e => e.id === empId);
    if (targetEmp) {
      const overridesToReset: Record<string, DayOverride | null> = {};
      Object.keys(targetEmp.dateOverrides || {}).forEach(dateStr => {
        if (dateStr.startsWith(currentMonthPrefix)) {
          overridesToReset[dateStr] = null;
        }
      });
      if (Object.keys(overridesToReset).length > 0) {
        onSaveMultipleOverrides(empId, overridesToReset);
      }
    }
  };

  const monthNamesRuNom = [
    'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
    'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'
  ];

  const getLatestStatus = (emp: Employee) => {
    if (!emp.statusHistory || emp.statusHistory.length === 0) return 'active';
    const sorted = [...emp.statusHistory].sort((a, b) => {
      const dateCompare = b.date.localeCompare(a.date);
      if (dateCompare !== 0) return dateCompare;
      return b.timestamp - a.timestamp;
    });
    return sorted[0].status;
  };

  const activeStaffList = employees.filter(emp => {
    const status = getLatestStatus(emp);
    return status !== 'fired' && status !== 'transferred_out';
  });

  // Overrides statistics
  const workOverrides = activeMonthOverrides.filter(x => x.override.type === 'work');
  const restOverrides = activeMonthOverrides.filter(x => x.override.type === 'rest');
  const totalOverriddenHours = workOverrides.reduce((sum, item) => sum + item.override.hours, 0);

  return (
    <div id="overrides-manager-card" className="bg-white rounded-2xl border border-slate-100 shadow-xs p-5 hover:shadow-md transition-shadow duration-300 space-y-3">
      
      {/* 1. Header with Title "Правки" */}
      <div className="flex items-start justify-between pb-2 border-b border-slate-100">
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
            <Settings className="w-4 h-4" />
          </div>
          <div>
            <h3 className="font-sans font-bold text-sm text-slate-800 tracking-tight">
              Правки
            </h3>
            <p className="text-[10px] text-slate-400 font-sans mt-0.5">
              Корректировки за {monthNamesRuNom[monthIndex]} {year} г.
            </p>
          </div>
        </div>
      </div>

      {/* 2. Embedded Reset logic */}
      <div className="bg-slate-50 border border-slate-100 p-2.5 rounded-xl space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-[9px] font-bold text-slate-450 uppercase tracking-wider block font-sans">
            Сброс правок
          </span>
          <select
            value={selectedResetEmpId}
            onChange={(e) => {
              setSelectedResetEmpId(e.target.value);
              setIsBulkConfirmOpen(false);
            }}
            className="bg-white hover:bg-slate-50 border border-slate-200/65 rounded-md text-[10px] font-bold py-0.5 px-1.5 text-slate-750 focus:outline-hidden cursor-pointer max-w-[125px] transition-all"
          >
            <option value="">Все сотрудники</option>
            {employees.filter(e => {
              const status = getLatestStatus(e);
              return status !== 'fired' && status !== 'transferred_out';
            }).map(emp => (
              <option key={emp.id} value={emp.id}>
                {emp.name.split(' ')[0]}
              </option>
            ))}
          </select>
        </div>

        {isBulkConfirmOpen ? (
          <div className="bg-rose-50/70 border border-rose-100 rounded-lg p-2 space-y-1.5 select-none">
            <span className="text-[10px] text-rose-950 font-bold block leading-relaxed">
              Удалить {totalOverridesToReset} переопределений за {monthNamesRuNom[monthIndex]}?
            </span>
            <div className="flex gap-1.5 justify-end">
              <button
                type="button"
                onClick={() => setIsBulkConfirmOpen(false)}
                className="text-[9px] font-bold px-2 py-0.5 bg-white border border-slate-200 rounded hover:bg-slate-50 cursor-pointer text-slate-700"
              >
                Отмена
              </button>
              <button
                type="button"
                onClick={onBulkReset}
                className="text-[9px] font-bold px-2 py-0.5 bg-rose-600 hover:bg-rose-700 text-white rounded cursor-pointer animate-pulse"
              >
                Сбросить
              </button>
            </div>
          </div>
        ) : (
          <div className="flex gap-1.5">
            <button
              type="button"
              onClick={() => {
                if (totalOverridesToReset === 0) {
                  alert('Нет ручных корректировок для сброса на данный момент.');
                  return;
                }
                setIsBulkConfirmOpen(true);
              }}
              disabled={totalOverridesToReset === 0}
              className={`flex-1 font-bold transition-all p-2 rounded-xl text-[10px] flex items-center justify-center gap-1.5 cursor-pointer ${
                totalOverridesToReset > 0
                  ? 'bg-rose-600 hover:bg-rose-700 text-white shadow-2xs active:scale-98'
                  : 'bg-slate-200 text-slate-400 cursor-not-allowed border border-slate-350/50'
              }`}
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Сброс {selectedResetEmpId ? 'выбранного' : 'всех'} ({totalOverridesToReset} дн.)
            </button>

            {bulkResetBackup && (
              <button
                type="button"
                onClick={onUndoBulkReset}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-[10px] py-2 px-2.5 rounded-xl flex items-center gap-1 transition-all cursor-pointer shadow-2xs shrink-0"
                title="Отменить сброс правок"
              >
                <Undo2 className="w-3.5 h-3.5" />
                Вернуть
              </button>
            )}
          </div>
        )}
      </div>

      {/* 3. Compact Tab Header Selectors */}
      <div className="flex border-b border-slate-105 text-[10px] font-sans font-bold pt-1 gap-1">
        <button
          type="button"
          onClick={() => setActiveTab('stats')}
          className={`flex-1 pb-1.5 border-b-2 text-center transition-all cursor-pointer ${
            activeTab === 'stats'
              ? 'border-indigo-600 text-indigo-700 font-extrabold'
              : 'border-transparent text-slate-400 hover:text-slate-600'
          }`}
        >
          Статистика
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('registry')}
          className={`flex-1 pb-1.5 border-b-2 text-center transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
            activeTab === 'registry'
              ? 'border-indigo-600 text-indigo-700 font-extrabold'
              : 'border-transparent text-slate-400 hover:text-slate-600'
          }`}
        >
          Реестр правок
          <span className={`px-1 py-0.2 rounded text-[8px] font-mono leading-none ${activeMonthOverrides.length > 0 ? 'bg-indigo-100 text-indigo-800 font-bold' : 'bg-slate-100 text-slate-400 font-normal'}`}>
            {activeMonthOverrides.length}
          </span>
        </button>
      </div>

      {/* 4. Tab Content Panels */}
      {activeTab === 'stats' ? (
        <div className="space-y-2 animate-in fade-in duration-100">
          <div className="grid grid-cols-2 gap-2 mt-1">
            <div className="bg-slate-50/55 border border-slate-100 p-1.5 px-2 rounded-xl text-center">
              <span className="text-[8px] text-slate-400 block uppercase font-bold leading-none">ПРАВКИ СМЕН:</span>
              <span className="text-xs font-black text-slate-800 block mt-0.5">{workOverrides.length} дн.</span>
              <span className="text-[7px] text-slate-400 font-mono leading-none block mt-0.5">Сумма: {totalOverriddenHours} ч.</span>
            </div>

            <div className="bg-slate-50/55 border border-slate-100 p-1.5 px-2 rounded-xl text-center">
              <span className="text-[8px] text-slate-400 block uppercase font-bold leading-none">ДОП. ВЫХОДНЫЕ:</span>
              <span className="text-xs font-black text-slate-800 block mt-0.5">{restOverrides.length} дн.</span>
              <span className="text-[7px] text-slate-400 font-mono leading-none block mt-0.5">Разгрузка</span>
            </div>
          </div>

          {/* Counter breakdown by staff */}
          <div className="max-h-[125px] overflow-y-auto space-y-1 pt-0.5 pr-1 font-sans">
            {activeStaffList.map(emp => {
              const colorSet = TAILWIND_COLORS[emp.color] || TAILWIND_COLORS.indigo;
              const empOverridesCount = activeMonthOverrides.filter(x => x.empId === emp.id).length;

              return (
                <div
                  key={emp.id}
                  className="bg-slate-50/30 hover:bg-slate-50/70 border border-slate-150/15 p-1 px-1.5 rounded-lg flex items-center justify-between transition-all"
                >
                  <span className="flex items-center gap-1.5 font-bold text-slate-750 text-[10px] truncate max-w-[130px]">
                    <span className={`w-1.5 h-1.5 rounded-full ${colorSet.bg}`} />
                    {emp.name.split(' ')[0]}
                  </span>

                  <div className="flex items-center gap-1.5 shrink-0">
                    {empOverridesCount > 0 ? (
                      <>
                        <span className="text-[8px] font-black font-mono text-amber-700 bg-amber-50 border border-amber-100/40 rounded px-1 py-0.2">
                          {empOverridesCount} дн.
                        </span>
                        <button
                          type="button"
                          onClick={() => handleResetSingleEmployeeOverrides(emp.id)}
                          className="p-0.5 text-slate-400 hover:text-rose-600 rounded cursor-pointer transition-colors"
                          title="Сбросить все правки этого сотрудника за месяц"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                        </button>
                      </>
                    ) : (
                      <span className="text-[8px] font-medium text-slate-400 font-sans">
                        В норме
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="animate-in fade-in duration-100">
          {activeMonthOverrides.length === 0 ? (
            <div className="py-5 text-center rounded-xl bg-slate-50 border border-slate-100">
              <Smile className="w-5 h-5 text-emerald-500 mx-auto mb-1 opacity-70" />
              <span className="text-[10px] font-bold text-emerald-950 block">Все чисто!</span>
              <span className="text-[9px] text-slate-450">Смены по норме ТК РФ</span>
            </div>
          ) : (
            <div className="space-y-1.5 max-h-[175px]/[max-content] max-h-[160px] overflow-y-auto pr-1">
              {activeMonthOverrides.map((item, idx) => {
                const dayName = new Date(year, monthIndex, item.dayNumber).toLocaleDateString('ru-RU', { weekday: 'short' });
                const dateNice = `${String(item.dayNumber).padStart(2, '0')}.${String(monthIndex + 1).padStart(2, '0')}`;
                const colorSet = TAILWIND_COLORS[item.empColor] || TAILWIND_COLORS.indigo;
                const isRest = item.override.type === 'rest';

                return (
                  <div
                    key={idx}
                    className="flex items-center justify-between bg-slate-50/50 hover:bg-slate-150/15 border border-slate-250/10 p-1 px-1.5 rounded-lg transition-all text-[10px]"
                  >
                    <div className="flex items-center gap-1.5 truncate">
                      <span className="font-mono font-bold text-slate-800 shrink-0">
                        {dateNice} <span className="text-[8px] text-slate-400 font-medium uppercase font-sans">({dayName})</span>
                      </span>
                      <div className="flex items-center gap-1.5 px-1.5 border-l border-slate-200 truncate">
                        <span className={`w-1.5 h-1.5 rounded-full ${colorSet.bg} shrink-0`} />
                        <span className="font-bold text-slate-700 truncate" title={item.empName}>
                          {item.empName.split(' ')[0]}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {isRest ? (
                        <span className="bg-indigo-50 border border-indigo-150 text-indigo-700 text-[8px] font-extrabold px-1 rounded leading-none py-0.2">Вых</span>
                      ) : (
                        <span className="bg-slate-100 border border-slate-200 text-slate-700 text-[8px] font-extrabold px-1 rounded leading-none py-0.2">{item.override.hours}ч</span>
                      )}
                      <button
                        onClick={() => handleDeleteSingleOverride(item.empId, item.dateStr)}
                        className="p-0.5 hover:bg-rose-50 text-slate-400 hover:text-rose-600 rounded cursor-pointer transition-colors"
                        title="Вернуться к базовой смене 4/2"
                        type="button"
                      >
                        <Undo2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

    </div>
  );
};
