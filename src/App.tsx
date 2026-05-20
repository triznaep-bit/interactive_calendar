/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { Calendar, UserCheck, ShieldAlert, Sparkles, LogOut, Sun, HelpCircle, Activity, Download, Printer, Gift, RotateCcw, Undo2, AlertTriangle, Trash2 } from 'lucide-react';
import { Employee, VacationBooking, ShopDetails, DayOverride, EmployeeStatusType, StatusHistoryRecord } from './types';
import { ShopCard } from './components/ShopCard';
import { CalendarGrid } from './components/CalendarGrid';
import { EmployeeManager } from './components/EmployeeManager';
import { OverridesManager } from './components/OverridesManager';
import { VacationModal } from './components/VacationModal';
import { DayEditorModal } from './components/DayEditorModal';
import { NotesAndTasksManager } from './components/NotesAndTasksManager';
import { calculateMonthStats, calculateRangeStats, formatDate, parseDate } from './utils';
import { exportScheduleToCSV, exportStatsToCSV } from './utils/exportUtils';
import { getShiftedPaymentDate } from './utils/paymentUtils';

// Key for storage persistence
const LOCAL_STORAGE_KEY = 'calendar_4_2_scheduler_v1_s2';

// Initial Russian-law complaint scheduler seeds
const DEFAULT_SHOP: ShopDetails = {
  id: 'shop-1',
  name: 'Северное Сияние',
  category: 'Супермаркет у дома',
  address: 'ул. Кораблестроителей, д. 30, Санкт-Петербург',
  operatingSince: '2024-03-01',
};

const DEFAULT_EMPLOYEES: Employee[] = [
  {
    id: 'emp-1',
    name: 'Иванов Иван Юрьевич',
    position: 'Старший продавец',
    color: 'indigo',
    startOffset: 0, // Works 1, 2, 3, 4 days in 6-day cycles
    dateOverrides: {},
    phone: '+7 (911) 222-33-44',
    birthDate: '1990-06-15', // June 15
    statusHistory: []
  },
  {
    id: 'emp-2',
    name: 'Петрова Анна Владимировна',
    position: 'Продавец-консультант',
    color: 'emerald',
    startOffset: 4, // Works 5, 6, 1, 2 days in 6-day cycles
    dateOverrides: {},
    phone: '+7 (921) 555-66-77',
    birthDate: '1994-06-03', // June 3
    statusHistory: []
  },
  {
    id: 'emp-3',
    name: 'Сидоров Алексей Петрович',
    position: 'Кассир',
    color: 'amber',
    startOffset: 2, // Works 3, 4, 5, 6 days in 6-day cycles
    dateOverrides: {},
    phone: '+7 (900) 888-99-00',
    birthDate: '1988-11-25', // November 25
    statusHistory: []
  },
];

// Seed vacation: Anna Takes Summer vacation including Russia Day (June 12), extending her vacation duration beautifully!
const DEFAULT_VACATIONS: VacationBooking[] = [
  {
    id: 'vacation-1',
    employeeId: 'emp-2',
    startDate: '2026-06-08',
    daysRequested: 10,
    endDate: '2026-06-18', // June 12 is Russian flag day of Russia -> shifts end by exactly 1 day
    holidaysIncluded: ['2026-06-12'],
  }
];

export default function App() {
  // Calendar positioning state
  const [year, setYear] = useState(2026);
  const [monthIndex, setMonthIndex] = useState(5); // June 2026

  // Date range filter states
  const [isRangeFilterActive, setIsRangeFilterActive] = useState(false);
  const [filterStartDateStr, setFilterStartDateStr] = useState('2026-06-01');
  const [filterEndDateStr, setFilterEndDateStr] = useState('2026-06-30');

  // Keep date filter defaults synchronized with active calendar month when inactive
  useEffect(() => {
    if (!isRangeFilterActive) {
      const start = formatDate(new Date(year, monthIndex, 1));
      const end = formatDate(new Date(year, monthIndex + 1, 0));
      setFilterStartDateStr(start);
      setFilterEndDateStr(end);
    }
  }, [year, monthIndex, isRangeFilterActive]);

  // Core Data States
  const [shop, setShop] = useState<ShopDetails>(DEFAULT_SHOP);
  const [employees, setEmployees] = useState<Employee[]>(DEFAULT_EMPLOYEES);
  const [vacations, setVacations] = useState<VacationBooking[]>(DEFAULT_VACATIONS);
  const [selectedBirthdayEmpId, setSelectedBirthdayEmpId] = useState<string>('');
  const [isBirthdayExpanded, setIsBirthdayExpanded] = useState(false);

  // Dynamic summer limit state
  const [summerHourLimit, setSummerHourLimit] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('shift_planner_summer_limit');
      return saved ? parseInt(saved) : 185;
    } catch {
      return 185;
    }
  });

  const handleUpdateSummerHourLimit = (limit: number) => {
    setSummerHourLimit(limit);
    localStorage.setItem('shift_planner_summer_limit', String(limit));
  };

  // Bulk Reset Sub-states
  const [selectedResetEmpId, setSelectedResetEmpId] = useState<string>('');
  const [isBulkConfirmOpen, setIsBulkConfirmOpen] = useState(false);
  const [bulkResetBackup, setBulkResetBackup] = useState<Record<string, Record<string, DayOverride>> | null>(null);
  const [showBulkResetPanel, setShowBulkResetPanel] = useState(false);

  // Helper calculates overrides in selected month
  const countMonthlyOverridesForEmp = (emp: Employee) => {
    const currentMonthPrefix = `${year}-${String(monthIndex + 1).padStart(2, '0')}-`;
    return Object.keys(emp.dateOverrides || {}).filter(dStr => dStr.startsWith(currentMonthPrefix)).length;
  };

  const totalOverridesToReset = selectedResetEmpId !== ''
    ? countMonthlyOverridesForEmp(employees.find(e => e.id === selectedResetEmpId) || { dateOverrides: {} } as any)
    : employees.reduce((acc, emp) => acc + countMonthlyOverridesForEmp(emp), 0);

  const handleBulkResetMonthOverrides = () => {
    const currentMonthPrefix = `${year}-${String(monthIndex + 1).padStart(2, '0')}-`;
    const backup: Record<string, Record<string, DayOverride>> = {};
    
    const nextEmployees = employees.map(emp => {
      if (selectedResetEmpId !== '' && emp.id !== selectedResetEmpId) return emp;
      
      const nextOverrides = { ...emp.dateOverrides };
      const empBackup: Record<string, DayOverride> = {};
      
      if (emp.dateOverrides) {
        Object.keys(emp.dateOverrides).forEach((dateStr) => {
          const override = emp.dateOverrides[dateStr];
          if (dateStr.startsWith(currentMonthPrefix) && override) {
            empBackup[dateStr] = override;
            delete nextOverrides[dateStr];
          }
        });
      }
      
      if (Object.keys(empBackup).length > 0) {
        backup[emp.id] = empBackup;
      }
      
      return {
        ...emp,
        dateOverrides: nextOverrides
      };
    });
    
    setBulkResetBackup(backup);
    setEmployees(nextEmployees);
    syncToStorage(shop, nextEmployees, vacations);
    setIsBulkConfirmOpen(false);
  };

  const handleUndoBulkReset = () => {
    if (!bulkResetBackup) return;
    
    const nextEmployees = employees.map(emp => {
      const backupForEmp = bulkResetBackup[emp.id];
      if (!backupForEmp) return emp;
      
      return {
        ...emp,
        dateOverrides: {
          ...emp.dateOverrides,
          ...backupForEmp
        }
      };
    });
    
    setEmployees(nextEmployees);
    syncToStorage(shop, nextEmployees, vacations);
    setBulkResetBackup(null);
  };

  // Modals Visibility
  const [isVacationOpen, setIsVacationOpen] = useState(false);
  const [isDayEditorOpen, setIsDayEditorOpen] = useState(false);
  const [isExportDropdownOpen, setIsExportDropdownOpen] = useState(false);

  // Editing Sub-states
  const [activeEmployeeForEdit, setActiveEmployeeForEdit] = useState<Employee | null>(null);
  const [activeDateForEdit, setActiveDateForEdit] = useState<Date | null>(null);

  // 1. Storage Sync on Boot
  useEffect(() => {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        if (parsed.shop) setShop(parsed.shop);
        if (parsed.employees) setEmployees(parsed.employees);
        if (parsed.vacations) setVacations(parsed.vacations);
      } catch (e) {
        console.error('Failed to parse schedule storage:', e);
      }
    }
  }, []);

  // 2. Storage Sync on Update
  const syncToStorage = (updatedShop: ShopDetails, updatedEmployees: Employee[], updatedVacations: VacationBooking[]) => {
    localStorage.setItem(
      LOCAL_STORAGE_KEY,
      JSON.stringify({
        shop: updatedShop,
        employees: updatedEmployees,
        vacations: updatedVacations,
      })
    );
  };

  // 3. Handlers for Employees
  const handleAddEmployee = (name: string, position: string, color: string, startOffset: number, phone?: string, birthDate?: string, hireDate?: string) => {
    const newEmp: Employee = {
      id: `emp-${Date.now()}`,
      name,
      position,
      color,
      startOffset,
      dateOverrides: {},
      phone,
      birthDate,
      hireDate,
      statusHistory: []
    };
    const nextArr = [...employees, newEmp];
    setEmployees(nextArr);
    syncToStorage(shop, nextArr, vacations);
  };

  const handleUpdateStatus = (id: string, status: EmployeeStatusType, startDate: string, note?: string) => {
    const nextArr = employees.map((emp) => {
      if (emp.id !== id) return emp;
      const newRecord: StatusHistoryRecord = {
        id: `status-${Date.now()}`,
        date: startDate,
        status,
        note,
        timestamp: Date.now()
      };
      return {
        ...emp,
        statusHistory: [...(emp.statusHistory || []), newRecord]
      };
    });
    setEmployees(nextArr);
    syncToStorage(shop, nextArr, vacations);
  };

  const handleDeleteEmployeeFully = (id: string) => {
    const nextArr = employees.filter((e) => e.id !== id);
    // clean up associated vacations
    const nextVacations = vacations.filter((v) => v.employeeId !== id);
    setEmployees(nextArr);
    setVacations(nextVacations);
    syncToStorage(shop, nextArr, nextVacations);
  };

  const handleUpdateOffset = (id: string, offset: number) => {
    const nextArr = employees.map((e) => (e.id === id ? { ...e, startOffset: offset } : e));
    setEmployees(nextArr);
    syncToStorage(shop, nextArr, vacations);
  };

  const handleUpdateEmployee = (id: string, updated: Partial<Omit<Employee, 'id'>>) => {
    const nextArr = employees.map((e) => (e.id === id ? { ...e, ...updated } : e));
    setEmployees(nextArr);
    syncToStorage(shop, nextArr, vacations);
  };

  // 4. Handlers for Vacations under Russian laws
  const handleAddVacation = (newVac: Omit<VacationBooking, 'id'>) => {
    const created: VacationBooking = {
      ...newVac,
      id: `vacation-${Date.now()}`,
    };
    const nextVacations = [...vacations, created];
    setVacations(nextVacations);
    syncToStorage(shop, employees, nextVacations);
  };

  const handleDeleteVacation = (id: string) => {
    const nextVacations = vacations.filter((v) => v.id !== id);
    setVacations(nextVacations);
    syncToStorage(shop, employees, nextVacations);
  };

  // 5. Day status override modifier
  const handleSaveDayOverride = (employeeId: string, dateStr: string, override: DayOverride | null) => {
    const nextArr = employees.map((emp) => {
      if (emp.id !== employeeId) return emp;
      const nextOverrides = { ...emp.dateOverrides };
      if (override === null) {
        delete nextOverrides[dateStr];
      } else {
        nextOverrides[dateStr] = override;
      }
      return {
        ...emp,
        dateOverrides: nextOverrides,
      };
    });
    setEmployees(nextArr);
    // Dynamic refresh in background
    syncToStorage(shop, nextArr, vacations);
  };

  const handleSaveMultipleOverrides = (employeeId: string, overrides: Record<string, DayOverride | null>) => {
    const nextArr = employees.map((emp) => {
      if (emp.id !== employeeId) return emp;
      const nextOverrides = { ...emp.dateOverrides };
      Object.entries(overrides).forEach(([dateStr, override]) => {
        if (override === null) {
          delete nextOverrides[dateStr];
        } else {
          nextOverrides[dateStr] = override;
        }
      });
      return {
        ...emp,
        dateOverrides: nextOverrides,
      };
    });
    setEmployees(nextArr);
    syncToStorage(shop, nextArr, vacations);
  };

  // 6. Shop updates
  const handleUpdateShop = (updated: ShopDetails) => {
    setShop(updated);
    syncToStorage(updated, employees, vacations);
  };

  // Sub-modal toggle
  const handleSelectDayToEdit = (employee: Employee, date: Date) => {
    setActiveEmployeeForEdit(employee);
    setActiveDateForEdit(date);
    setIsDayEditorOpen(true);
  };

  // Aggregate team stats dynamically based on period filtering
  let totalTeamHours = 0;
  let totalTeamDays = 0;

  employees.forEach((emp) => {
    const s = isRangeFilterActive
      ? calculateRangeStats(emp, parseDate(filterStartDateStr), parseDate(filterEndDateStr), vacations)
      : calculateMonthStats(emp, year, monthIndex, vacations);
    totalTeamHours += s.workHours;
    totalTeamDays += s.workDays;
  });

  const monthNamesRuNom = [
    'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
    'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'
  ];

  const activePeriodTitle = isRangeFilterActive
    ? `${filterStartDateStr.split('-').reverse().join('.')} - ${filterEndDateStr.split('-').reverse().join('.')}`
    : `${monthNamesRuNom[monthIndex]} ${year}`;

  const handleExportSchedule = () => {
    const start = isRangeFilterActive ? parseDate(filterStartDateStr) : new Date(year, monthIndex, 1);
    const end = isRangeFilterActive ? parseDate(filterEndDateStr) : new Date(year, monthIndex + 1, 0);
    exportScheduleToCSV(employees, start, end, vacations, activePeriodTitle);
  };

  const handleExportStats = () => {
    const start = isRangeFilterActive ? parseDate(filterStartDateStr) : new Date(year, monthIndex, 1);
    const end = isRangeFilterActive ? parseDate(filterEndDateStr) : new Date(year, monthIndex + 1, 0);
    exportStatsToCSV(employees, start, end, vacations, activePeriodTitle);
  };

  return (
    <div className="bg-slate-50 min-h-screen text-slate-800 flex flex-col font-sans selection:bg-indigo-100 antialiased pb-12">
      
      {/* Brand Navigation Header */}
      <header id="main-nav" className="bg-white border-b border-slate-100 px-6 py-4 sticky top-0 z-30 shadow-3xs">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-600 rounded-2xl flex items-center justify-center text-white font-black text-xl tracking-tight shadow-sm shadow-indigo-200">
              42
            </div>
            <div>
              <h1 id="app-heading" className="font-sans font-black text-lg text-slate-800 tracking-tight flex items-center gap-1.5 leading-none">
                Календарь-Планировщик ТК РФ <span className="text-[10px] bg-indigo-50 text-indigo-600 font-bold ml-1.5 px-2 py-0.5 rounded-full uppercase">Смены 4/2</span>
              </h1>
              <span className="text-[11px] text-slate-400 font-mono">
                Расчет рабочих часов по законодательству РФ в режиме реального времени
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden md:flex items-center gap-2 bg-slate-50 border border-slate-200/60 rounded-xl px-3.5 py-1.5 text-xs text-slate-500 font-medium">
              <Activity className="w-3.5 h-3.5 text-emerald-500 animate-pulse" />
              <span>База данных: LocalStorage</span>
            </div>

            <button
              id="header-vacation-modal-trigger"
              onClick={() => setIsVacationOpen(true)}
              className="px-4 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-semibold font-sans rounded-xl text-xs transition-all flex items-center gap-1.5 cursor-pointer shadow-3xs"
            >
              <Sun className="w-4 h-4 text-amber-500 fill-amber-100" />
              Калькулятор Отпусков по ТК
            </button>

            {/* Export Dropdown Menu */}
            <div className="relative">
              <button
                id="export-dropdown-trigger"
                onClick={() => setIsExportDropdownOpen(!isExportDropdownOpen)}
                className="px-4 py-2 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 font-semibold font-sans rounded-xl text-xs transition-all flex items-center gap-1.5 cursor-pointer shadow-3xs flex bg-gradient-to-r from-white to-slate-50"
              >
                <Download className="w-4 h-4 text-indigo-600" />
                Экспорт данных
              </button>

              {isExportDropdownOpen && (
                <>
                  <div className="fixed inset-0 z-30" onClick={() => setIsExportDropdownOpen(false)} />
                  <div className="absolute right-0 mt-2 w-60 bg-white border border-slate-200 rounded-xl shadow-xl z-40 py-1.5 overflow-hidden font-sans">
                    <div className="px-3 py-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100">
                      Экспорт ({activePeriodTitle})
                    </div>
                    <button
                      id="export-csv-schedule-btn"
                      onClick={() => {
                        handleExportSchedule();
                        setIsExportDropdownOpen(false);
                      }}
                      className="w-full text-left px-4 py-2 text-xs text-slate-700 hover:bg-indigo-50 hover:text-indigo-700 transition-colors flex items-center gap-2 cursor-pointer"
                    >
                      <span className="text-sm">📅</span> Экспорт графика (CSV)
                    </button>
                    <button
                      id="export-csv-stats-btn"
                      onClick={() => {
                        handleExportStats();
                        setIsExportDropdownOpen(false);
                      }}
                      className="w-full text-left px-4 py-2 text-xs text-slate-700 hover:bg-indigo-50 hover:text-indigo-700 transition-colors flex items-center gap-2 cursor-pointer"
                    >
                      <span className="text-sm">📊</span> Экспорт статистики (CSV)
                    </button>
                    <button
                      id="export-print-btn"
                      onClick={() => {
                        setIsExportDropdownOpen(false);
                        window.print();
                      }}
                      className="w-full text-left px-4 py-2 text-xs text-slate-700 hover:bg-indigo-50 hover:text-indigo-700 transition-colors flex items-center gap-2 cursor-pointer border-t border-slate-100"
                    >
                      <Printer className="w-3.5 h-3.5 text-slate-500" /> Печать / Сохранить в PDF
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>

        </div>
      </header>

      {/* Main Content Area */}
      <main className="max-w-7xl mx-auto px-6 py-8 flex-1 w-full space-y-8">
        
        {/* Top grid section */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          
          {/* Left Large Column (Grid schedule) */}
          <div className="lg:col-span-8 space-y-6">
            <CalendarGrid
              year={year}
              monthIndex={monthIndex}
              onMonthChange={(numY, numM) => {
                setYear(numY);
                setMonthIndex(numM);
              }}
              employees={employees}
              vacations={vacations}
              onSelectDay={handleSelectDayToEdit}
              filterStartDateStr={filterStartDateStr}
              filterEndDateStr={filterEndDateStr}
              isRangeFilterActive={isRangeFilterActive}
              onToggleRangeFilter={setIsRangeFilterActive}
              onRangeFilterChange={(start, end) => {
                setFilterStartDateStr(start);
                setFilterEndDateStr(end);
              }}
              renderBirthdayPanel={() => {
                interface AlertItem {
                  employee: Employee;
                  bDay: number;
                  bMonth: number;
                  message: string;
                }
                const upcomingAlerts: AlertItem[] = [];
                
                employees.forEach((emp) => {
                  if (!emp.birthDate) return;
                  const currentStatus = emp.statusHistory && emp.statusHistory.length > 0 
                    ? [...emp.statusHistory].sort((a,b) => b.timestamp - a.timestamp)[0].status 
                    : 'active';
                  if (currentStatus === 'fired') return; // skip fired employees

                  const [, bMonth, bDay] = emp.birthDate.split('-').map(Number);
                  
                  // Check for current viewed monthIndex
                  const salaryShifted = getShiftedPaymentDate(year, monthIndex, 10);
                  const advanceShifted = getShiftedPaymentDate(year, monthIndex, 25);
                  
                  // Birthday in current viewed year-month
                  const bDateCurrent = new Date(year, bMonth - 1, bDay);
                  
                  // 7 days before salary 10th
                  const oneWeekBeforeSalary = new Date(salaryShifted.getTime());
                  oneWeekBeforeSalary.setDate(salaryShifted.getDate() - 7);
                  
                  // 7 days before advance 25th
                  const oneWeekBeforeAdvance = new Date(advanceShifted.getTime());
                  oneWeekBeforeAdvance.setDate(advanceShifted.getDate() - 7);
                  
                  // Check if birthday falls between [oneWeekBeforeSalary, salaryDate] or [oneWeekBeforeAdvance, advanceDate]
                  const isNearSalary = bDateCurrent.getTime() >= oneWeekBeforeSalary.getTime() && bDateCurrent.getTime() <= salaryShifted.getTime();
                  const isNearAdvance = bDateCurrent.getTime() >= oneWeekBeforeAdvance.getTime() && bDateCurrent.getTime() <= advanceShifted.getTime();

                  if (isNearSalary || isNearAdvance) {
                    upcomingAlerts.push({
                      employee: emp,
                      bDay,
                      bMonth,
                      message: `У ${emp.name} скоро день рождения.`
                    });
                  }
                });

                // Active workers for dropdown selector
                const activeEmployees = employees.filter(e => {
                  const currentStatus = e.statusHistory && e.statusHistory.length > 0 
                    ? [...e.statusHistory].sort((a,b) => b.timestamp - a.timestamp)[0].status 
                    : 'active';
                  return currentStatus !== 'fired';
                });

                // Calculate displayed items based on dropdown selection
                let displayedAlerts = [...upcomingAlerts];
                let selectedEmp: Employee | undefined;
                let hasNoDateMessage = false;
                
                if (selectedBirthdayEmpId) {
                  selectedEmp = activeEmployees.find(e => e.id === selectedBirthdayEmpId);
                  if (selectedEmp) {
                    if (selectedEmp.birthDate) {
                      const [, bMonth, bDay] = selectedEmp.birthDate.split('-').map(Number);
                      displayedAlerts = [{
                        employee: selectedEmp,
                        bDay,
                        bMonth,
                        message: `У ${selectedEmp.name} скоро день рождения.`
                      }];
                    } else {
                      displayedAlerts = [];
                      hasNoDateMessage = true;
                    }
                  }
                }

                const hasBirthdaysToShow = displayedAlerts.length > 0;

                const handleNavigateToDay = (bDay: number, bMonth: number) => {
                  setMonthIndex(bMonth - 1);
                  setTimeout(() => {
                    const el = document.getElementById(`day-cell-${year}-${bMonth - 1}-${bDay}`);
                    if (el) {
                      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                      el.classList.add('ring-4', 'ring-purple-400', 'transition-all');
                      setTimeout(() => {
                        el.classList.remove('ring-4', 'ring-purple-400');
                      }, 2500);
                    }
                  }, 150);
                };

                return (
                  <div className="flex flex-wrap items-center justify-end gap-3">
                    {/* 1. birthday panel block */}
                    <div className="relative inline-block text-left">
                      <div className="flex items-center gap-1.5 bg-gradient-to-r from-purple-50/70 to-indigo-50/70 border border-purple-200/40 rounded-xl p-1 px-2.5 shadow-3xs hover:from-purple-50/90 hover:to-indigo-50/90 transition-all select-none">
                        <div className="flex items-center gap-1.5 cursor-pointer max-w-[210px]" onClick={() => setIsBirthdayExpanded(!isBirthdayExpanded)}>
                          <span className="text-sm">🎂</span>
                          <span className="text-xs font-bold text-purple-950 truncate">День рождения</span>
                        </div>
                        
                        <select
                          value={selectedBirthdayEmpId}
                          onChange={(e) => {
                            setSelectedBirthdayEmpId(e.target.value);
                            setIsBirthdayExpanded(true);
                          }}
                          className="bg-white/80 hover:bg-white border border-purple-200/50 rounded-md text-[10px] font-bold py-0.5 px-1.5 text-purple-900 focus:outline-hidden cursor-pointer max-w-[140px] transition-all"
                        >
                          <option value="">Все (ближайшие)</option>
                          {activeEmployees.map(emp => (
                            <option key={emp.id} value={emp.id}>
                              {emp.name} {emp.birthDate ? `🎂` : `(—)`}
                            </option>
                          ))}
                        </select>

                        <button 
                          onClick={() => setIsBirthdayExpanded(!isBirthdayExpanded)}
                          className="text-purple-800 text-[10px] font-bold h-5 px-1 rounded hover:bg-purple-100/50 cursor-pointer ml-1"
                        >
                          {isBirthdayExpanded ? '▲' : '▼'}
                        </button>
                      </div>

                      {isBirthdayExpanded && (
                        <div className="absolute right-0 mt-1.5 w-80 bg-white/95 backdrop-blur-md text-purple-950 border border-purple-100 rounded-xl p-2.5 shadow-lg flex flex-col gap-1.5 z-40 animate-in fade-in slide-in-from-top-1 duration-150 animate-out duration-150">
                          {hasBirthdaysToShow ? (
                            displayedAlerts.map((alert, index) => (
                              <div key={index} className="font-semibold text-purple-900 bg-purple-50/50 py-1.5 px-2.5 rounded-lg border border-purple-100/35 flex items-center justify-between gap-3 text-xs">
                                <span className="inline-flex items-center gap-1">
                                  <span>🎈</span>
                                  <span className="truncate max-w-[170px]" title={alert.message}>{alert.message}</span>
                                  <span className="text-[10px] text-purple-600 bg-purple-100/50 px-1 py-0.5 rounded font-bold font-mono shrink-0">
                                    {String(alert.bDay).padStart(2, '0')}.{String(alert.bMonth).padStart(2, '0')}
                                  </span>
                                </span>
                                <button
                                  onClick={() => handleNavigateToDay(alert.bDay, alert.bMonth)}
                                  className="bg-purple-600 hover:bg-purple-700 hover:shadow-2xs active:scale-95 text-white text-[10px] font-bold font-sans py-0.5 px-2 rounded transition-all cursor-pointer shrink-0"
                                >
                                  Перейти
                                </button>
                              </div>
                            ))
                          ) : hasNoDateMessage ? (
                            <div className="text-[11px] font-medium text-purple-700 bg-purple-50/40 py-1.5 px-2.5 rounded-lg border border-purple-150/10">
                              У этого сотрудника не заполнена дата рождения. Настройте в карточке ниже.
                            </div>
                          ) : (
                            <div className="text-[11px] font-medium text-purple-750 bg-purple-50/40 py-1.5 px-2.5 rounded-lg border border-purple-150/10 text-center">
                              Ближайшие дни рождения отсутствуют 🎉
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              }}
            />
          </div>

          {/* Right Small Column (Store metrics / parameters / overrides / staff lists) */}
          <div className="lg:col-span-4 space-y-6">
            <ShopCard
              shop={shop}
              onUpdateShop={handleUpdateShop}
              year={year}
              monthIndex={monthIndex}
              totalTeamHours={totalTeamHours}
              totalTeamDays={totalTeamDays}
              isRangeFilterActive={isRangeFilterActive}
            />

            <OverridesManager
              employees={employees}
              year={year}
              monthIndex={monthIndex}
              onSaveMultipleOverrides={handleSaveMultipleOverrides}
              selectedResetEmpId={selectedResetEmpId}
              setSelectedResetEmpId={setSelectedResetEmpId}
              totalOverridesToReset={totalOverridesToReset}
              isBulkConfirmOpen={isBulkConfirmOpen}
              setIsBulkConfirmOpen={setIsBulkConfirmOpen}
              onBulkReset={handleBulkResetMonthOverrides}
              onUndoBulkReset={handleUndoBulkReset}
              bulkResetBackup={bulkResetBackup}
            />
          </div>

        </div>

        {/* Lower section: Staff cards & Month stats */}
        <div className="pt-2">
          <EmployeeManager
            employees={employees}
            vacations={vacations}
            onAddEmployee={handleAddEmployee}
            onUpdateOffset={handleUpdateOffset}
            onUpdateStatus={handleUpdateStatus}
            onUpdateEmployee={handleUpdateEmployee}
            onDeleteEmployeeFully={handleDeleteEmployeeFully}
            onSaveMultipleOverrides={handleSaveMultipleOverrides}
            year={year}
            monthIndex={monthIndex}
            filterStartDateStr={filterStartDateStr}
            filterEndDateStr={filterEndDateStr}
            isRangeFilterActive={isRangeFilterActive}
            summerHourLimit={summerHourLimit}
          />
        </div>

        {/* Notes & Additional tasks section */}
        <div className="mt-8 border-t border-slate-100/85 pt-8">
          <NotesAndTasksManager employees={employees} vacations={vacations} />
        </div>

      </main>

      {/* Sub-modals elements */}
      <VacationModal
        isOpen={isVacationOpen}
        onClose={() => setIsVacationOpen(false)}
        employees={employees}
        vacations={vacations}
        onAddVacation={handleAddVacation}
        onDeleteVacation={handleDeleteVacation}
      />

      <DayEditorModal
        isOpen={isDayEditorOpen}
        onClose={() => setIsDayEditorOpen(false)}
        employee={activeEmployeeForEdit}
        date={activeDateForEdit}
        vacations={vacations}
        onSaveOverride={handleSaveDayOverride}
      />

    </div>
  );
}
