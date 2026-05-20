/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  User,
  UserPlus,
  Phone,
  Gift,
  Clock,
  Calendar,
  Settings,
  Eye,
  Trash2,
  Sparkles,
  AlertTriangle,
  ChevronDown,
  Info,
  Pencil
} from 'lucide-react';
import { Employee, EmployeeStatusType, VacationBooking, DayOverride, DayType } from '../types';
import {
  TAILWIND_COLORS,
  calculateMonthStats,
  calculateRangeStats,
  checkSummerConstraints,
  parseDate,
  getEmployeeDayStatus,
  formatDate,
  getStandardHoursForDate
} from '../utils';

interface EmployeeManagerProps {
  employees: Employee[];
  vacations: VacationBooking[];
  year: number;
  monthIndex: number; // 0-indexed
  isRangeFilterActive: boolean;
  filterStartDateStr: string;
  filterEndDateStr: string;
  onAddEmployee: (name: string, position: string, color: string, startOffset: number, phone?: string, birthDate?: string, hireDate?: string) => void;
  onUpdateEmployee?: (employeeId: string, updated: Partial<Omit<Employee, 'id'>>) => void;
  onDeleteEmployeeFully: (employeeId: string) => void;
  onUpdateOffset: (employeeId: string, offset: number) => void;
  onUpdateStatus: (employeeId: string, status: EmployeeStatusType, date: string, note?: string) => void;
  onSaveMultipleOverrides?: (employeeId: string, overrides: Record<string, DayOverride | null>) => void;
  summerHourLimit: number;
}

const POSITIONS = ['Администратор', 'Старший продавец', 'Продавец-кассир', 'Продавец/Подработка', 'Директор магазина'];
const AVAILABLE_COLORS = ['indigo', 'emerald', 'amber', 'rose', 'sky', 'purple'];

const STATUS_LABELS: Record<EmployeeStatusType, string> = {
  active: 'Активен',
  fired: 'Уволен',
  transferred_out: 'Убыл',
  transferred_in: 'Вернулся',
  reemployed: 'Снова в штате',
};

const STATUS_BADGE_CLASSES: Record<EmployeeStatusType, string> = {
  active: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  fired: 'bg-rose-50 text-rose-700 border-rose-200',
  transferred_out: 'bg-amber-50 text-amber-700 border-amber-200',
  transferred_in: 'bg-blue-50 text-blue-700 border-blue-200',
  reemployed: 'bg-indigo-50 text-indigo-700 border-indigo-200',
};

export const EmployeeManager: React.FC<EmployeeManagerProps> = ({
  employees,
  vacations,
  year,
  monthIndex,
  isRangeFilterActive,
  filterStartDateStr,
  filterEndDateStr,
  onAddEmployee,
  onUpdateEmployee,
  onDeleteEmployeeFully,
  onUpdateOffset,
  onUpdateStatus,
  onSaveMultipleOverrides,
  summerHourLimit,
}) => {
  // Local state
  const [searchTerm, setSearchTerm] = useState('');
  const [filterPosition, setFilterPosition] = useState('all');
  const [showHiddenArchived, setShowHiddenArchived] = useState(false);

  // Popup overlay states instead of inline blocks to retain compact card ratio
  const [showAddForm, setShowAddForm] = useState(false);
  const [showSimulator, setShowSimulator] = useState(false);

  // Status Change Dialog states
  const [statusTargetEmployee, setStatusTargetEmployee] = useState<Employee | null>(null);
  const [selectedStatusType, setSelectedStatusType] = useState<EmployeeStatusType>('fired');
  const [statusDate, setStatusDate] = useState('');
  const [statusNote, setStatusNote] = useState('');
  const [statusDoubleConfirm, setStatusDoubleConfirm] = useState(false);
  const [deleteConfirmState, setDeleteConfirmState] = useState(false);

  // Edit Employee state variables
  const [editTargetEmployee, setEditTargetEmployee] = useState<Employee | null>(null);
  const [editEmployeeName, setEditEmployeeName] = useState('');
  const [editEmployeePos, setEditEmployeePos] = useState('');
  const [editEmployeeOffset, setEditEmployeeOffset] = useState(0);
  const [editEmployeePhone, setEditEmployeePhone] = useState('');
  const [editEmployeeBirthDate, setEditEmployeeBirthDate] = useState('');
  const [editEmployeeColor, setEditEmployeeColor] = useState('indigo');
  const [editEmployeeHireDate, setEditEmployeeHireDate] = useState('');
  const [editDoubleConfirm, setEditDoubleConfirm] = useState(false);

  // View Archive dialog state
  const [viewHistoryEmployee, setViewHistoryEmployee] = useState<Employee | null>(null);

  // New employee state
  const [newEmployeeName, setNewEmployeeName] = useState('');
  const [newEmployeePos, setNewEmployeePos] = useState(POSITIONS[2]);
  const [newEmployeeOffset, setNewEmployeeOffset] = useState(0);
  const [newEmployeePhone, setNewEmployeePhone] = useState('');
  const [newEmployeeBirthDate, setNewEmployeeBirthDate] = useState('');
  const [newEmployeeColor, setNewEmployeeColor] = useState(AVAILABLE_COLORS[0]);
  const [newEmployeeHireDate, setNewEmployeeHireDate] = useState('');

  // Simulator state variables
  const [simStartDate, setSimStartDate] = useState(() => {
    const today = new Date();
    return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-01`;
  });
  const [simDaysRequested, setSimDaysRequested] = useState(14);
  const [simEmployeeId, setSimEmployeeId] = useState('');

  const monthNamesRu = [
    'Январе', 'Феврале', 'Марте', 'Апреле', 'Мае', 'Июне',
    'Июле', 'Августе', 'Сентябре', 'Октябре', 'Ноябре', 'Декабре'
  ];

  const monthNamesRuNom = [
    'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
    'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'
  ];

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmployeeName.trim()) return;

    onAddEmployee(
      newEmployeeName.trim(),
      newEmployeePos,
      newEmployeeColor,
      newEmployeeOffset,
      newEmployeePhone.trim() || undefined,
      newEmployeeBirthDate || undefined,
      newEmployeeHireDate || undefined
    );

    // Reset state & hide form
    setNewEmployeeName('');
    setNewEmployeePhone('');
    setNewEmployeeBirthDate('');
    setNewEmployeeHireDate('');
    setNewEmployeeColor(AVAILABLE_COLORS[Math.floor(Math.random() * AVAILABLE_COLORS.length)]);
    setNewEmployeeOffset((employees.length * 2) % 6);
    setShowAddForm(false);
  };

  const handleOpenStatusChange = (emp: Employee) => {
    setStatusTargetEmployee(emp);
    setSelectedStatusType('fired');
    setStatusDate(() => {
      const today = new Date();
      const y = today.getFullYear();
      const m = String(today.getMonth() + 1).padStart(2, '0');
      const d = String(today.getDate()).padStart(2, '0');
      return `${y}-${m}-${d}`;
    });
    setStatusNote('');
    setStatusDoubleConfirm(false);
    setDeleteConfirmState(false);
  };

  const submitStatusChange = (e: React.FormEvent) => {
    e.preventDefault();
    if (!statusTargetEmployee) return;

    if (!statusDoubleConfirm) {
      setStatusDoubleConfirm(true);
      return;
    }

    onUpdateStatus(
      statusTargetEmployee.id,
      selectedStatusType,
      statusDate,
      statusNote.trim() || undefined
    );

    setStatusTargetEmployee(null);
    setStatusDoubleConfirm(false);
  };

  const handleOpenEditEmployee = (emp: Employee) => {
    setEditTargetEmployee(emp);
    setEditEmployeeName(emp.name);
    setEditEmployeePos(emp.position);
    setEditEmployeeOffset(emp.startOffset);
    setEditEmployeePhone(emp.phone || '');
    setEditEmployeeBirthDate(emp.birthDate || '');
    setEditEmployeeColor(emp.color || 'indigo');
    setEditEmployeeHireDate(emp.hireDate || '');
    setEditDoubleConfirm(false);
  };

  const submitEditEmployee = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editTargetEmployee) return;

    if (!editDoubleConfirm) {
      setEditDoubleConfirm(true);
      return;
    }

    if (onUpdateEmployee) {
      onUpdateEmployee(editTargetEmployee.id, {
        name: editEmployeeName.trim(),
        position: editEmployeePos,
        startOffset: editEmployeeOffset,
        phone: editEmployeePhone.trim() || undefined,
        birthDate: editEmployeeBirthDate || undefined,
        color: editEmployeeColor,
        hireDate: editEmployeeHireDate || undefined
      });
    }

    setEditTargetEmployee(null);
    setEditDoubleConfirm(false);
  };

  const handleAutoFixSummerRegulations = (emp: Employee) => {
    if (!onSaveMultipleOverrides) return;

    const totalDays = new Date(year, monthIndex + 1, 0).getDate();
    const maxAllowedDays = totalDays === 30 ? 20 : 21;

    interface DayData {
      dateStr: string;
      date: Date;
      type: DayType;
      hours: number;
      isConflictWithOthers: boolean;
    }

    const monthDays: DayData[] = [];
    for (let dNum = 1; dNum <= totalDays; dNum++) {
      const d = new Date(year, monthIndex, dNum);
      const dateStr = formatDate(d);
      const statusInfo = getEmployeeDayStatus(emp, d, vacations);

      let isConflict = false;
      if (statusInfo.type === 'work') {
        const othersWorkingCount = employees.some(other => {
          if (other.id === emp.id) return false;
          const otherStatus = getEmployeeDayStatus(other, d, vacations);
          return otherStatus.type === 'work';
        });
        isConflict = othersWorkingCount;
      }

      monthDays.push({
        dateStr,
        date: d,
        type: statusInfo.type,
        hours: statusInfo.hours,
        isConflictWithOthers: isConflict
      });
    }

    let overridesToApply: Record<string, DayOverride | null> = {};
    let currentWorkDays = monthDays.filter(day => day.type === 'work');

    if (currentWorkDays.length > maxAllowedDays) {
      const safeWorkDaysToConvert = currentWorkDays.filter(day => day.isConflictWithOthers);
      const workDaysToConvert = [...safeWorkDaysToConvert]
        .sort((a, b) => b.date.getTime() - a.date.getTime())
        .slice(0, currentWorkDays.length - maxAllowedDays);

      workDaysToConvert.forEach(day => {
        overridesToApply[day.dateStr] = { type: 'rest', hours: 0 };
        const idx = monthDays.findIndex(md => md.dateStr === day.dateStr);
        if (idx !== -1) {
          monthDays[idx].type = 'rest';
          monthDays[idx].hours = 0;
        }
      });
    }

    // Modern exact 10 or 8 hours balancing algorithm - strictly no shifts of < 8 hours allowed
    const finalWorkDays = monthDays.filter(day => day.type === 'work');
    const N = finalWorkDays.length;

    if (N > 0) {
      // 10 * x + 8 * (N - x) = 8 * N + 2 * x = summerHourLimit
      // 2 * x = summerHourLimit - 8 * N => x = (summerHourLimit - 8 * N) / 2
      let targetX = Math.round((summerHourLimit - 8 * N) / 2);
      targetX = Math.max(0, Math.min(N, targetX));

      // Order of priority: keep normal 10h days as 10h, and normal 8h days as 8h.
      const sortedForAssignment = [...finalWorkDays].sort((a, b) => {
        const stdA = getStandardHoursForDate(a.date);
        const stdB = getStandardHoursForDate(b.date);
        if (stdA !== stdB) {
          return stdB - stdA; // 10h before 8h
        }
        return a.date.getTime() - b.date.getTime();
      });

      const targetHoursMap = new Map<string, number>();
      for (let i = 0; i < sortedForAssignment.length; i++) {
        const day = sortedForAssignment[i];
        if (i < targetX) {
          targetHoursMap.set(day.dateStr, 10);
        } else {
          targetHoursMap.set(day.dateStr, 8);
        }
      }

      finalWorkDays.forEach(day => {
        const targetH = targetHoursMap.get(day.dateStr) || 10;
        
        // Check baseline status to avoid creating unnecessary manual overrides if baseline already matches
        const baselineEmployee = {
          ...emp,
          dateOverrides: { ...emp.dateOverrides }
        };
        if (baselineEmployee.dateOverrides) {
          delete baselineEmployee.dateOverrides[day.dateStr];
        }

        const baselineInfo = getEmployeeDayStatus(baselineEmployee, day.date, vacations);

        if (baselineInfo.type === 'work' && baselineInfo.hours === targetH) {
          // Revert overrides to pristine state if baseline naturally matches our 10 or 8 target
          if (emp.dateOverrides && emp.dateOverrides[day.dateStr] !== undefined) {
            overridesToApply[day.dateStr] = null;
          }
        } else {
          // Assign clean, explicit standard override (guarantees either 8 or 10 hours)
          overridesToApply[day.dateStr] = { type: 'work', hours: targetH };
        }
      });
    }

    if (Object.keys(overridesToApply).length > 0) {
      onSaveMultipleOverrides(emp.id, overridesToApply);
    }
  };

  const getLatestStatus = (emp: Employee): EmployeeStatusType => {
    if (!emp.statusHistory || emp.statusHistory.length === 0) return 'active';
    const sorted = [...emp.statusHistory].sort((a, b) => {
      const dateCompare = b.date.localeCompare(a.date);
      if (dateCompare !== 0) return dateCompare;
      return b.timestamp - a.timestamp;
    });
    return sorted[0].status;
  };

  const isOfficialRussiaHoliday = (dStr: string) => {
    const parts = dStr.split('-');
    if (parts.length < 3) return false;
    const m = parseInt(parts[1], 10);
    const d = parseInt(parts[2], 10);
    if (m === 1 && d >= 1 && d <= 8) return true;
    if (m === 2 && d === 23) return true;
    if (m === 3 && d === 8) return true;
    if (m === 5 && d === 1) return true;
    if (m === 5 && d === 9) return true;
    if (m === 6 && d === 12) return true;
    if (m === 11 && d === 4) return true;
    return false;
  };

  const isEmployeeHiddenStatus = (status: EmployeeStatusType) => status === 'fired' || status === 'transferred_out';

  const activeEmployeesCount = employees.filter(e => !isEmployeeHiddenStatus(getLatestStatus(e))).length;
  const hiddenEmployeesCount = employees.filter(e => isEmployeeHiddenStatus(getLatestStatus(e))).length;

  const currentMonthBirthdays = employees.filter(e => {
    if (isEmployeeHiddenStatus(getLatestStatus(e)) || !e.birthDate) return false;
    const parts = e.birthDate.split('-');
    if (parts.length < 2) return false;
    const bMonth = parseInt(parts[1], 10);
    return bMonth === monthIndex + 1;
  });

  let totalWorkHoursScheduled = 0;
  employees.forEach(emp => {
    if (isEmployeeHiddenStatus(getLatestStatus(emp))) return;
    const stats = isRangeFilterActive
      ? calculateRangeStats(emp, parseDate(filterStartDateStr), parseDate(filterEndDateStr), vacations)
      : calculateMonthStats(emp, year, monthIndex, vacations);
    totalWorkHoursScheduled += stats.workHours;
  });

  const filteredEmployees = employees.filter((emp) => {
    const isHidden = isEmployeeHiddenStatus(getLatestStatus(emp));
    // If showHiddenArchived is on, filter to show only archives; otherwise active only
    if (showHiddenArchived) {
      if (!isHidden) return false;
    } else {
      if (isHidden) return false;
    }

    const matchesSearch = emp.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          (emp.phone && emp.phone.includes(searchTerm));
    const matchesPosition = filterPosition === 'all' || emp.position === filterPosition;
    return matchesSearch && matchesPosition;
  });

  return (
    <div
      id="employee-manager-section" 
      className="bg-white rounded-2xl border border-slate-100 p-5 shadow-xs flex flex-col hover:shadow-md transition-shadow duration-300"
    >
      
      {/* 1. Unified Header and Controls Area */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100 shrink-0">
        {/* Title and subtitle */}
        <div className="flex items-center gap-2 shrink-0">
          <div className="p-1.5 bg-indigo-50 text-indigo-600 rounded-lg">
            <User className="w-3.5 h-3.5" />
          </div>
          <div>
            <h3 className="font-sans font-extrabold text-sm text-slate-800 tracking-tight leading-none">
              Персонал
            </h3>
            <span className="text-[9px] text-slate-400 font-sans block mt-0.5">
              {isRangeFilterActive ? 'Выбранный период' : `${monthNamesRuNom[monthIndex]} ${year}`}
            </span>
          </div>
        </div>

        {/* Action and Filter buttons right-aligned */}
        <div className="flex flex-wrap items-center gap-2 flex-1 sm:justify-end">
          {/* 1. Shortened Search input */}
          <div className="relative max-w-[150px] sm:max-w-[165px] w-full">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Поиск по ФИО/Тел"
              className="w-full bg-slate-50 hover:bg-slate-100 focus:bg-white border border-slate-200/80 rounded-xl text-[10px] py-1.5 pl-7 pr-2 focus:outline-hidden focus:ring-1 focus:ring-indigo-500 font-sans font-medium"
            />
            <span className="absolute left-2.5 top-2.2 text-[9px] select-none text-slate-400">🔍</span>
          </div>

          {/* 2. Position label / select */}
          <select
            value={filterPosition}
            onChange={(e) => setFilterPosition(e.target.value)}
            className="bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl text-[10px] py-1.5 px-2 text-slate-700 font-semibold focus:outline-hidden cursor-pointer max-w-[110px] sm:max-w-[125px]"
          >
            <option value="all">Все роли</option>
            {POSITIONS.map(pos => (
              <option key={pos} value={pos}>{pos}</option>
            ))}
          </select>

          {/* 3. Hidden employees toggle */}
          <button
            type="button"
            onClick={() => setShowHiddenArchived(prev => !prev)}
            className={`px-2.5 py-1.5 rounded-xl border text-[10px] font-bold flex items-center justify-center gap-1 cursor-pointer transition-all shrink-0 ${
              showHiddenArchived
                ? 'bg-amber-500 hover:bg-amber-600 border-amber-500 text-white shadow-3xs'
                : 'bg-emerald-50 hover:bg-emerald-100 border-emerald-150 text-emerald-700'
            }`}
          >
            {showHiddenArchived ? '📂 Скрытые' : '📁 Скрытые'}
            {hiddenEmployeesCount > 0 && (
              <span className={`px-1.5 py-0.2 rounded-full font-black text-[9px] ${
                showHiddenArchived ? 'bg-white text-amber-700' : 'bg-emerald-200 text-emerald-800'
              }`}>
                {hiddenEmployeesCount}
              </span>
            )}
          </button>

          {/* 4. Calculator of vacations button */}
          <button
            type="button"
            onClick={() => setShowSimulator(true)}
            title="Калькулятор отпусков (ст. 120 ТК РФ)"
            className="p-1.5 bg-purple-50 hover:bg-purple-100 text-purple-700 rounded-xl border border-purple-200/20 cursor-pointer transition-colors"
          >
            <Settings className="w-3.5 h-3.5" />
          </button>
          
          {/* 5. Cadres (add employee) button */}
          <button
            type="button"
            onClick={() => setShowAddForm(true)}
            className="p-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl flex items-center gap-1 font-bold text-[10px] cursor-pointer shadow-3xs hover:scale-101 active:scale-99 transition-all"
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>Кадры</span>
          </button>
        </div>
      </div>

      {/* 3. Compact Metrics Side-by-Side Horizontal block */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-left mb-3 shrink-0">
        <div className="bg-slate-50/50 p-2.5 rounded-xl flex items-center gap-2.5 border border-slate-100">
          <Clock className="w-4 h-4 text-indigo-500 shrink-0" />
          <div className="truncate">
            <span className="text-[8px] text-slate-400 block uppercase font-extrabold leading-none">Запланировано всего часов:</span>
            <span className="text-xs font-black font-mono text-slate-800 block mt-0.5">{totalWorkHoursScheduled} ч.</span>
          </div>
        </div>

        <div className="bg-slate-50/50 p-2.5 rounded-xl flex items-center gap-2.5 border border-slate-100">
          <User className="w-4 h-4 text-emerald-500 shrink-0" />
          <div className="truncate">
            <span className="text-[8px] text-slate-400 block uppercase font-extrabold leading-none">Активный штат сотрудников (всего):</span>
            <span className="text-xs font-black text-slate-800 block mt-0.5">{activeEmployeesCount} активных ({employees.length} в базе) чел.</span>
          </div>
        </div>
      </div>

      {/* 4. Optimized Responsive Grid of cards */}
      <div className="flex-1 overflow-y-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 pr-1 py-1" id="employees-grid">
        {filteredEmployees.map((emp) => {
          const stats = isRangeFilterActive
            ? calculateRangeStats(emp, parseDate(filterStartDateStr), parseDate(filterEndDateStr), vacations)
            : calculateMonthStats(emp, year, monthIndex, vacations);
          const summerChecks = checkSummerConstraints(emp, year, monthIndex, vacations, summerHourLimit);
          const colorSet = TAILWIND_COLORS[emp.color] || TAILWIND_COLORS.indigo;
          const currentStatus = getLatestStatus(emp);
          const isFired = currentStatus === 'fired';

          let isBirthdayThisMonth = false;
          let isBirthdayToday = false;
          if (emp.birthDate) {
            const [, bMonth, bDay] = emp.birthDate.split('-').map(Number);
            isBirthdayThisMonth = bMonth === monthIndex + 1;
            const today = new Date();
            isBirthdayToday = bMonth === (today.getMonth() + 1) && bDay === today.getDate();
          }

          const hasViolations = summerChecks.isSummerMonth && (!summerChecks.hoursValid || !summerChecks.daysValid);

          // Build Initials for Avatar
          const nameParts = emp.name.split(' ');
          const initials = nameParts.length >= 2 
            ? `${nameParts[0][0]}${nameParts[1][0]}`.toUpperCase()
            : emp.name.slice(0, 2).toUpperCase();

          return (
            <div
              key={emp.id}
              id={`emp-card-${emp.id}`}
              className={`bg-slate-50/40 hover:bg-slate-50/90 border border-slate-150/40 rounded-xl p-2.5 transition-all flex flex-col gap-1.5 relative overflow-hidden ${
                isFired ? 'opacity-55 grayscale' : ''
              }`}
            >
              {/* Left colored bar strip */}
              <div className={`absolute left-0 top-0 bottom-0 w-1 ${isFired ? 'bg-slate-400' : colorSet.bg}`} />

              <div className="flex items-center justify-between gap-2 pl-1.5 text-xs">
                <div className="flex items-center gap-2 truncate">
                  {/* Initial Circle */}
                  <div className={`w-7 h-7 rounded-lg text-[10px] font-bold flex items-center justify-center shrink-0 ${colorSet.bg} text-white`}>
                    {initials}
                  </div>
                  <div className="truncate">
                    <h4 className="font-extrabold text-slate-800 truncate leading-tight flex items-center gap-1">
                      {emp.name.split(' ').slice(0, 2).join(' ')}
                      {isBirthdayThisMonth && !isFired && (
                        <span title="День рождения в этом месяце">🎈</span>
                      )}
                    </h4>
                    <span className="text-[9px] text-slate-450 block font-normal leading-none mt-0.5">{emp.position}</span>
                  </div>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => handleOpenEditEmployee(emp)}
                    className="p-1 text-slate-400 hover:text-amber-650 hover:bg-amber-50 rounded-md cursor-pointer transition-all"
                    title="Редактировать ФИО, телефон, роль, цвет и смещение"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>

                  <button
                    onClick={() => setViewHistoryEmployee(emp)}
                    className="p-1 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-md cursor-pointer transition-all"
                    title="Архив кадровых перемещений"
                  >
                    <Eye className="w-3.5 h-3.5" />
                  </button>
                  
                  <button
                    onClick={() => handleOpenStatusChange(emp)}
                    className="p-1 text-indigo-500 hover:text-indigo-700 hover:bg-indigo-50 rounded-md cursor-pointer transition-all"
                    title="Кадровый статус (уволить, перевести, стереть из базы)"
                  >
                    <Settings className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Grid block for micro metrics badgification */}
              <div className="grid grid-cols-4 gap-1 pl-1.5">
                <div className="bg-slate-100/50 p-1 rounded text-center" title="Часы">
                  <span className="text-[7px] text-slate-400 block font-bold leading-none">ЧАСЫ</span>
                  <span className="text-[10px] font-bold font-mono text-slate-800">{stats.workHours}ч</span>
                </div>
                <div className="bg-slate-100/50 p-1 rounded text-center" title="Смены">
                  <span className="text-[7px] text-slate-400 block font-bold leading-none">СМЕНЫ</span>
                  <span className="text-[10px] font-bold text-slate-800">{stats.workDays}д</span>
                </div>
                <div className="bg-indigo-50/50 p-1 rounded text-center" title="Отпуск">
                  <span className="text-[7px] text-indigo-400 block font-bold leading-none">ОТПУСК</span>
                  <span className="text-[10px] font-bold text-indigo-800">{stats.vacationCalendarDays}кд</span>
                </div>
                <div className="bg-rose-50/50 p-1 rounded text-center" title="Болезнь">
                  <span className="text-[7px] text-rose-450 block font-bold leading-none">БОЛЬН</span>
                  <span className="text-[10px] font-bold text-rose-800">{stats.sickDays}д</span>
                </div>
              </div>

              {/* Dynamic start rotation offset dropdown selector */}
              <div className="flex items-center justify-between pl-1.5 pt-1 border-t border-slate-150/15 text-[9px] text-slate-450 font-semibold font-sans">
                <span>Ротация смен (4/2):</span>
                <select
                  value={emp.startOffset !== undefined ? emp.startOffset : 0}
                  onChange={(e) => onUpdateOffset(emp.id, parseInt(e.target.value))}
                  disabled={isFired}
                  className="bg-transparent hover:bg-slate-100 border-none font-bold text-slate-700 py-0.2 px-1 focus:outline-hidden cursor-pointer"
                >
                  <option value={0}>Смена АС1</option>
                  <option value={4}>Смена АС2</option>
                  <option value={2}>Смена ВС1</option>
                  <option value={1}>Смещ. +1д</option>
                  <option value={3}>Смещ. +3д</option>
                  <option value={5}>Смещ. +5д</option>
                </select>
              </div>

              {/* Auto Fix constraints spark alert */}
              {hasViolations && !isFired && (
                <div className="bg-amber-50 rounded-lg p-1.5 pl-2 border border-amber-100/65 flex items-center justify-between gap-2 animate-pulse mt-0.5">
                  <div className="flex items-center gap-1 truncate">
                    <Sparkles className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                    <span className="text-[8px] font-extrabold text-amber-900 truncate">
                      Лимит по ТК РФ нарушен: {stats.workHours}ч (лимит {summerHourLimit}ч)
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleAutoFixSummerRegulations(emp)}
                    className="bg-amber-600 hover:bg-amber-700 text-white font-extrabold px-1.5 py-0.5 rounded text-[8px] shrink-0"
                    title="Автоматически распределить часы и выходные для балансировки по норме"
                  >
                    Исправить
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* =======================================================
          POPUP MODALS SECURING TO NOT ENLARGE OUTER SQUARES
          ======================================================= */}

      {/* Add Employee Dialog Modal */}
      {showAddForm && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-55 p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col">
            <div className="p-5 border-b border-indigo-50 bg-slate-50 flex items-center justify-between">
              <h3 className="font-sans font-bold text-sm text-slate-800 flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-indigo-500" />
                Оформление нового сотрудника
              </h3>
              <button
                type="button"
                onClick={() => setShowAddForm(false)}
                className="p-1 hover:bg-slate-200 rounded-lg text-slate-400 hover:text-slate-600 cursor-pointer text-sm"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreate} className="p-5 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                    ФИО сотрудника
                  </label>
                  <input
                    type="text"
                    value={newEmployeeName}
                    onChange={(e) => setNewEmployeeName(e.target.value)}
                    placeholder="Например, Смирнов Илья"
                    maxLength={30}
                    required
                    className="w-full bg-slate-50 border border-slate-200 text-xs rounded-xl focus:ring-1 focus:ring-indigo-500 p-2.5 font-semibold text-slate-800"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                    Должность
                  </label>
                  <select
                    value={newEmployeePos}
                    onChange={(e) => setNewEmployeePos(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 text-xs rounded-xl focus:ring-1 focus:ring-indigo-500 p-2.5 text-slate-800 font-semibold"
                  >
                    {POSITIONS.map((pos) => (
                      <option key={pos} value={pos}>{pos}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                    Сдвиг на старте (4/2)
                  </label>
                  <select
                    value={newEmployeeOffset}
                    onChange={(e) => setNewEmployeeOffset(parseInt(e.target.value))}
                    className="w-full bg-slate-50 border border-slate-200 text-xs rounded-xl focus:ring-1 focus:ring-indigo-500 p-2.5 text-slate-800 font-semibold"
                  >
                    <option value={0}>Смена АС1 (Дни 1, 2, 3, 4)</option>
                    <option value={4}>Смена АС2 (Дни 1, 2, 5, 6)</option>
                    <option value={2}>Смена ВС1 (Дни 3, 4, 5, 6)</option>
                    <option value={1}>Смещение на +1 день</option>
                    <option value={3}>Смещение на +3 дня</option>
                    <option value={5}>Смещение на +5 дней</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                    Номер телефона
                  </label>
                  <input
                    type="tel"
                    value={newEmployeePhone}
                    onChange={(e) => setNewEmployeePhone(e.target.value)}
                    placeholder="+7 (999) 123-45-67"
                    className="w-full bg-slate-50 border border-slate-200 text-xs rounded-xl focus:ring-1 focus:ring-indigo-500 p-2.5 font-mono text-slate-850"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                    Дата рождения
                  </label>
                  <input
                    type="date"
                    value={newEmployeeBirthDate}
                    onChange={(e) => setNewEmployeeBirthDate(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 text-xs rounded-xl focus:ring-1 focus:ring-indigo-500 p-2.5 font-mono text-slate-850"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                    Дата трудоустройства
                  </label>
                  <input
                    type="date"
                    value={newEmployeeHireDate}
                    onChange={(e) => setNewEmployeeHireDate(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 text-xs rounded-xl focus:ring-1 focus:ring-indigo-500 p-2.5 font-mono text-slate-850"
                  />
                </div>
              </div>

              {/* Color previews */}
              <div className="pt-2">
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">
                  Цветовая идентификация в табеле
                </label>
                <div className="flex items-center gap-2">
                  {AVAILABLE_COLORS.map((color) => {
                    const details = TAILWIND_COLORS[color] || { bg: 'bg-slate-400' };
                    return (
                      <button
                        key={color}
                        type="button"
                        onClick={() => setNewEmployeeColor(color)}
                        className={`w-7 h-7 rounded-full cursor-pointer transition-all flex items-center justify-center border-2 ${details.bg} ${
                          newEmployeeColor === color ? 'border-indigo-600 scale-110 ring-2 ring-indigo-200' : 'border-transparent'
                        }`}
                      >
                        {newEmployeeColor === color && (
                          <span className="text-white text-[11px] font-bold">✓</span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddForm(false)}
                  className="py-1.5 px-3.5 text-xs text-slate-500 bg-slate-100/50 hover:bg-slate-100 rounded-xl font-semibold cursor-pointer"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  className="py-1.5 px-5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl cursor-pointer shadow-3xs"
                >
                  Оформить в штат
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Vacation extension simulator modal */}
      {showSimulator && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-55 p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl w-full max-w-xl shadow-2xl overflow-hidden flex flex-col">
            <div className="p-5 border-b border-purple-50 bg-slate-50 flex items-center justify-between">
              <h3 className="font-sans font-bold text-sm text-purple-950 flex items-center gap-1.5">
                <Settings className="w-4 h-4 text-purple-600" />
                Интерактивный симулятор отпусков (ст. 120 ТК РФ)
              </h3>
              <button
                type="button"
                onClick={() => setShowSimulator(false)}
                className="p-1 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-600 cursor-pointer text-sm"
              >
                ✕
              </button>
            </div>

            <div className="p-5 space-y-4 max-h-[75vh] overflow-y-auto">
              <p className="text-xs text-purple-900/80 leading-relaxed">
                Согласно части 1 статьи 120 ТК РФ, нерабочие праздничные дни РФ, приходящиеся на период ежегодного оплачиваемого отпуска, в число календарных дней отпуска не включаются. Они сдвигают дату окончания отпуска вперед, сохраняя при этом количество оплачиваемых дней.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-purple-50 p-3 rounded-2xl border border-purple-100">
                <div>
                  <label className="block text-[9px] font-bold text-purple-800 uppercase mb-1">
                    Начало отпуска
                  </label>
                  <input
                    type="date"
                    value={simStartDate}
                    onChange={(e) => setSimStartDate(e.target.value)}
                    className="w-full bg-white border border-purple-200 text-xs rounded-lg p-1.5 focus:outline-hidden font-mono"
                  />
                </div>

                <div>
                  <label className="block text-[9px] font-bold text-purple-800 uppercase mb-1">
                    Оплачиваемые дни
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={56}
                    value={simDaysRequested}
                    onChange={(e) => setSimDaysRequested(Math.max(1, parseInt(e.target.value) || 1))}
                    className="w-full bg-white border border-purple-200 text-xs rounded-lg p-1.5 focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-[9px] font-bold text-purple-800 uppercase mb-1">
                    Сотрудник
                  </label>
                  <select
                    value={simEmployeeId}
                    onChange={(e) => setSimEmployeeId(e.target.value)}
                    className="w-full bg-white border border-purple-200 text-xs rounded-lg p-1.5 focus:outline-hidden"
                  >
                    <option value="">Без привязки</option>
                    {employees.filter(e => getLatestStatus(e) !== 'fired').map(emp => (
                      <option key={emp.id} value={emp.id}>{emp.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              {(() => {
                if (!simStartDate) return null;
                try {
                  const start = new Date(simStartDate);
                  let current = new Date(start.getTime());
                  let daysSpent = 0;
                  const holidaysHit: string[] = [];

                  while (daysSpent < simDaysRequested) {
                    const yearStr = current.getFullYear();
                    const monthStr = String(current.getMonth() + 1).padStart(2, '0');
                    const dayStr = String(current.getDate()).padStart(2, '0');
                    const pathStr = `${yearStr}-${monthStr}-${dayStr}`;

                    if (isOfficialRussiaHoliday(pathStr)) {
                      holidaysHit.push(pathStr);
                    } else {
                      daysSpent++;
                    }

                    if (daysSpent < simDaysRequested) {
                      current.setDate(current.getDate() + 1);
                    }
                  }

                  const endDateCalculated = current;
                  const formattedEnd = `${String(endDateCalculated.getDate()).padStart(2, '0')}.${String(endDateCalculated.getMonth() + 1).padStart(2, '0')}.${endDateCalculated.getFullYear()}`;
                  const holidaysCount = holidaysHit.length;

                  return (
                    <div className="bg-amber-50 rounded-2xl p-4 border border-amber-100 text-xs space-y-2 text-amber-950">
                      <span className="font-bold flex items-center gap-1">
                        🇷🇺 Результат расчета по ст. 120 ТК РФ:
                      </span>
                      <p>
                        Отпуск продлится с <strong>{simStartDate.split('-').reverse().join('.')}</strong> по <strong>{formattedEnd}</strong> включительно.
                      </p>
                      <p className="text-[11px] text-amber-900 mt-1">
                        Всего: <strong>{simDaysRequested + holidaysCount}</strong> календарных дней (компенсировано <strong>{holidaysCount}</strong> праздничных дней).
                      </p>
                      {holidaysCount > 0 && (
                        <p className="text-[10px] text-purple-900 font-mono italic">
                          Выявленные праздники: {holidaysHit.map(h => h.split('-').reverse().slice(0, 2).join('.')).join(', ')}
                        </p>
                      )}
                    </div>
                  );
                } catch (err) {
                  return <div className="text-rose-500 text-xs">Ошибка расчета</div>;
                }
              })()}
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end">
              <button
                type="button"
                onClick={() => setShowSimulator(false)}
                className="bg-indigo-600 text-white font-bold text-xs py-2 px-5 rounded-xl cursor-pointer hover:bg-indigo-700 shadow-3xs"
              >
                Закрыть
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Change Status dialog Modal */}
      {statusTargetEmployee && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-55 p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col">
            <div className="p-5 border-b border-indigo-50 bg-slate-50 flex items-center justify-between">
              <h3 className="font-sans font-bold text-sm text-slate-850 flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 text-indigo-505" />
                Кадровый статус
              </h3>
              <button
                type="button"
                onClick={() => setStatusTargetEmployee(null)}
                className="p-1 hover:bg-slate-200 rounded-lg text-slate-400 hover:text-slate-600 cursor-pointer text-sm"
              >
                ✕
              </button>
            </div>

            <form onSubmit={submitStatusChange} className="p-5 space-y-4">
              <div>
                <span className="text-[9px] uppercase font-bold text-slate-400 block tracking-wider font-sans">Сотрудник</span>
                <span className="text-sm font-bold text-slate-800 block mt-0.5">{statusTargetEmployee.name}</span>
              </div>

              <div>
                <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">Новый статус</label>
                <select
                  value={selectedStatusType}
                  onChange={(e) => {
                    setSelectedStatusType(e.target.value as EmployeeStatusType);
                    setStatusDoubleConfirm(false);
                  }}
                  className="w-full bg-slate-50 border border-slate-200 text-xs rounded-xl p-2 focus:ring-1 focus:ring-indigo-500 font-sans"
                >
                  <option value="fired">Уволен</option>
                  <option value="transferred_out">Убыл на другую точку</option>
                  <option value="transferred_in">Вернулся на точку</option>
                  <option value="reemployed">Снова трудоустроен</option>
                  <option value="active">Активен / Снять все метки</option>
                </select>
              </div>

              <div>
                <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">Дата изменения</label>
                <input
                  type="date"
                  value={statusDate}
                  onChange={(e) => setStatusDate(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 text-xs rounded-xl p-2 focus:ring-1 focus:ring-indigo-500 font-mono"
                  required
                />
              </div>

              <div>
                <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">Примечание (обоснование)</label>
                <textarea
                  value={statusNote}
                  onChange={(e) => setStatusNote(e.target.value)}
                  placeholder="Причина увольнения/перевода..."
                  className="w-full bg-slate-50 border border-slate-200 text-xs rounded-xl p-2.5 focus:ring-1 focus:ring-indigo-500 min-h-[60px]"
                />
              </div>

              {statusDoubleConfirm && (
                <div className="bg-rose-50 border border-rose-100 rounded-xl p-3 text-[11px] text-rose-850 space-y-1">
                  <p className="font-extrabold flex items-center gap-1 text-rose-800">⚠️ Подтвердите смену статуса:</p>
                  <p>Установить «{STATUS_LABELS[selectedStatusType]}» с {statusDate.split('-').reverse().join('.')}?</p>
                </div>
              )}

              <div className="pt-2 border-t border-slate-100 flex justify-end gap-2 text-xs">
                {employees.length > 1 && (
                  deleteConfirmState ? (
                    <button
                      type="button"
                      onClick={() => {
                        onDeleteEmployeeFully(statusTargetEmployee.id);
                        setStatusTargetEmployee(null);
                        setDeleteConfirmState(false);
                      }}
                      className="mr-auto px-2.5 py-1 text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-250 rounded-lg cursor-pointer font-bold animate-pulse text-[10px]"
                    >
                      ⚠️ Точно стереть? [ДА]
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        setDeleteConfirmState(true);
                      }}
                      className="mr-auto text-rose-600 hover:text-rose-800 hover:underline cursor-pointer font-medium"
                    >
                      Стереть совсем
                    </button>
                  )
                )}

                <button
                  type="button"
                  onClick={() => setStatusTargetEmployee(null)}
                  className="px-3 py-1.5 bg-slate-100 text-slate-600 rounded-lg cursor-pointer hover:bg-slate-150"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  className={`px-4 py-1.5 text-white font-bold rounded-lg cursor-pointer ${
                    statusDoubleConfirm ? 'bg-rose-600 hover:bg-rose-700' : 'bg-indigo-600 hover:bg-indigo-700'
                  }`}
                >
                  {statusDoubleConfirm ? 'Подтвердить' : 'Сохранить'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Employee details modal */}
      {editTargetEmployee && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-55 p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col animate-in slide-in-from-bottom-4">
            <div className="p-5 border-b border-indigo-50 bg-slate-50 flex items-center justify-between">
              <h3 className="font-sans font-bold text-sm text-slate-850 flex items-center gap-1.5">
                <Pencil className="w-4 h-4 text-indigo-505" />
                Редактирование сотрудника
              </h3>
              <button
                type="button"
                onClick={() => setEditTargetEmployee(null)}
                className="p-1 hover:bg-slate-200 rounded-lg text-slate-400 hover:text-slate-600 cursor-pointer text-sm"
              >
                ✕
              </button>
            </div>

            <form onSubmit={submitEditEmployee} className="p-5 space-y-4 max-h-[80vh] overflow-y-auto">
              <div>
                <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">ФИО сотрудника</label>
                <input
                  type="text"
                  value={editEmployeeName}
                  onChange={(e) => {
                    setEditEmployeeName(e.target.value);
                    setEditDoubleConfirm(false);
                  }}
                  className="w-full bg-slate-50 border border-slate-200 text-xs rounded-xl p-2.5 focus:ring-1 focus:ring-indigo-500 font-sans font-bold text-slate-800"
                  required
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">Номер телефона</label>
                  <input
                    type="tel"
                    value={editEmployeePhone}
                    placeholder="+7 (999) 000-00-00"
                    onChange={(e) => {
                      setEditEmployeePhone(e.target.value);
                      setEditDoubleConfirm(false);
                    }}
                    className="w-full bg-slate-50 border border-slate-200 text-xs rounded-xl p-2.5 focus:ring-1 focus:ring-indigo-500 font-mono text-slate-800"
                  />
                </div>
                <div>
                  <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">Дата рождения</label>
                  <input
                    type="date"
                    value={editEmployeeBirthDate}
                    onChange={(e) => {
                      setEditEmployeeBirthDate(e.target.value);
                      setEditDoubleConfirm(false);
                    }}
                    className="w-full bg-slate-50 border border-slate-200 text-xs rounded-xl p-2.5 focus:ring-1 focus:ring-indigo-500 font-mono text-slate-800"
                  />
                </div>
                <div>
                  <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">Дата трудоустройства</label>
                  <input
                    type="date"
                    value={editEmployeeHireDate}
                    onChange={(e) => {
                      setEditEmployeeHireDate(e.target.value);
                      setEditDoubleConfirm(false);
                    }}
                    className="w-full bg-slate-50 border border-slate-200 text-xs rounded-xl p-2.5 focus:ring-1 focus:ring-indigo-500 font-mono text-slate-800"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">Должность / Роль</label>
                <select
                  value={editEmployeePos}
                  onChange={(e) => {
                    setEditEmployeePos(e.target.value);
                    setEditDoubleConfirm(false);
                  }}
                  className="w-full bg-slate-50 border border-slate-200 text-xs rounded-xl p-2.5 focus:ring-1 focus:ring-indigo-500 font-sans text-slate-800"
                >
                  {POSITIONS.map((pos) => (
                    <option key={pos} value={pos}>{pos}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">Смещение цикла смен 4/2 (0-5)</label>
                <select
                  value={editEmployeeOffset}
                  onChange={(e) => {
                    setEditEmployeeOffset(parseInt(e.target.value, 10));
                    setEditDoubleConfirm(false);
                  }}
                  className="w-full bg-slate-50 border border-slate-200 text-xs rounded-xl p-2.5 focus:ring-1 focus:ring-indigo-500 font-mono text-slate-800"
                >
                  <option value={0}>0 (Рабочий день 1)</option>
                  <option value={1}>1 (Рабочий день 2)</option>
                  <option value={2}>2 (Рабочий день 3)</option>
                  <option value={3}>3 (Рабочий день 4)</option>
                  <option value={4}>4 (Выходной день 1)</option>
                  <option value={5}>5 (Выходной день 2)</option>
                </select>
                <span className="text-[9px] text-slate-450 block mt-1 leading-tight">
                  Сдвигает индивидуальный график 4/2 относительно дня начала отсчета (01.01.2026).
                </span>
              </div>

              <div>
                <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">Цветовая метка</label>
                <div className="flex gap-2 mt-1.5 animate-in fade-in duration-100">
                  {AVAILABLE_COLORS.map((col) => {
                    const colSet = TAILWIND_COLORS[col] || TAILWIND_COLORS.indigo;
                    return (
                      <button
                        key={col}
                        type="button"
                        onClick={() => {
                          setEditEmployeeColor(col);
                          setEditDoubleConfirm(false);
                        }}
                        className={`w-6 h-6 rounded-full border-2 transition-transform cursor-pointer hover:scale-110 active:scale-95 ${colSet.bg} ${
                          editEmployeeColor === col ? 'border-slate-800 scale-105 shadow-sm' : 'border-slate-250'
                        }`}
                        title={col}
                      />
                    );
                  })}
                </div>
              </div>

              {editDoubleConfirm && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-[11px] text-amber-900 space-y-1">
                  <p className="font-extrabold flex items-center gap-1 text-amber-800">⚠️ Подтвердите редактирование:</p>
                  <p>Сохранить изменения для {editEmployeeName}? Это сразу обновит его анкету и табель на всех экранах.</p>
                </div>
              )}

              <div className="pt-2 border-t border-slate-100 flex justify-end gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => setEditTargetEmployee(null)}
                  className="px-3 py-1.5 bg-slate-100 text-slate-650 rounded-lg cursor-pointer hover:bg-slate-150"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  className={`px-4 py-1.5 text-white font-bold rounded-lg cursor-pointer ${
                    editDoubleConfirm ? 'bg-amber-500 hover:bg-amber-600' : 'bg-indigo-600 hover:bg-indigo-700'
                  }`}
                >
                  {editDoubleConfirm ? 'Подтвердить' : 'Сохранить'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* History status archive dialogue modal */}
      {viewHistoryEmployee && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-55 p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col max-h-[75vh]">
            <div className="p-5 border-b border-indigo-50 bg-slate-50 flex items-center justify-between">
              <div>
                <h3 className="font-sans font-extrabold text-sm text-slate-800 flex items-center gap-1">
                  <Eye className="w-4 h-4 text-indigo-500" />
                  История кадровых изменений
                </h3>
                <span className="text-[10px] text-slate-400 block mt-0.5">{viewHistoryEmployee.name}</span>
              </div>
              <button
                onClick={() => setViewHistoryEmployee(null)}
                className="p-1 hover:bg-slate-200 rounded-lg text-slate-400 hover:text-slate-600 cursor-pointer text-sm"
              >
                ✕
              </button>
            </div>

            <div className="p-5 overflow-y-auto flex-1 space-y-4">
              {!viewHistoryEmployee.statusHistory || viewHistoryEmployee.statusHistory.length === 0 ? (
                <div className="text-center py-6 text-slate-400 text-xs">
                  <Info className="w-8 h-8 text-slate-200 mx-auto mb-1.5" />
                  <p>Изменений не проводилось.</p>
                </div>
              ) : (
                <div className="relative border-l border-indigo-100 ml-3 pl-5 space-y-4">
                  {viewHistoryEmployee.statusHistory.map((rec) => (
                    <div key={rec.id} className="relative text-xs">
                      <span className="absolute -left-[27px] top-1 w-2.5 h-2.5 rounded-full bg-indigo-600 border-2 border-white"></span>
                      <div>
                        <div className="flex items-center gap-1.5 font-bold">
                          <span>{rec.date.split('-').reverse().join('.')}</span>
                          <span className={`text-[8px] font-extrabold px-1.5 py-0.2 rounded border ${STATUS_BADGE_CLASSES[rec.status] || 'bg-slate-50'}`}>
                            {STATUS_LABELS[rec.status]}
                          </span>
                        </div>
                        {rec.note && <p className="text-[11px] text-slate-500 italic mt-0.5">{rec.note}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="p-3 bg-slate-50 border-t border-slate-100 flex justify-end">
              <button
                onClick={() => setViewHistoryEmployee(null)}
                className="bg-indigo-600 text-white font-extrabold text-[10px] py-1.5 px-4 rounded-xl cursor-pointer hover:bg-indigo-700"
              >
                Закрыть
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
