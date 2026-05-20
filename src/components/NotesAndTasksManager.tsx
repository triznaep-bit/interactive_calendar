import React, { useState, useEffect } from 'react';
import { FileText, Plus, Trash2, CheckSquare, Square, Check, UserCircle, Calendar, Briefcase, HelpCircle } from 'lucide-react';
import { Employee, VacationBooking } from '../types';
import { getEmployeeDayStatus, parseDate } from '../utils';

interface CustomNote {
  id: string;
  text: string;
  createdAt: string;
}

interface AdditionalWork {
  id: string;
  title: string;
  description?: string;
  assignedTo?: string; // Employee ID
  date?: string; // YYYY-MM-DD
  isCompleted: boolean;
  hoursSpent?: number;
}

interface NotesAndTasksManagerProps {
  employees: Employee[];
  vacations: VacationBooking[];
}

export const NotesAndTasksManager: React.FC<NotesAndTasksManagerProps> = ({ employees, vacations }) => {
  // Load initial states from LocalStorage
  const [notes, setNotes] = useState<CustomNote[]>(() => {
    try {
      const saved = localStorage.getItem('shift_planner_notes');
      return saved ? JSON.parse(saved) : [
        { id: '1', text: 'Проверить исправность кондиционера в торговом зале до начала летнего сезона.', createdAt: '2026-05-18' },
        { id: '2', text: 'Подготовить отчет по переработкам за май для бухгалтерии.', createdAt: '2026-05-19' }
      ];
    } catch {
      return [];
    }
  });

  const [additionalWorks, setAdditionalWorks] = useState<AdditionalWork[]>(() => {
    try {
      const saved = localStorage.getItem('shift_planner_additional_works');
      return saved ? JSON.parse(saved) : [
        { id: '1', title: 'Генеральная уборка склада', description: 'Разложить коробки по категориям, протереть пыль', assignedTo: employees[0]?.id || '', date: '2026-05-22', isCompleted: false },
        { id: '2', title: 'Ревизия витрин с зимним товаром', description: 'Пересчет остатков, перемещение остатков на хранение', assignedTo: employees[1]?.id || '', date: '2026-05-24', isCompleted: true }
      ];
    } catch {
      return [];
    }
  });

  // State for adding note
  const [newNoteText, setNewNoteText] = useState('');

  // State for adding additional work
  const [newWorkTitle, setNewWorkTitle] = useState('');
  const [newWorkDesc, setNewWorkDesc] = useState('');
  const [newWorkAssignedId, setNewWorkAssignedId] = useState('');
  const [newWorkDate, setNewWorkDate] = useState('');
  const [newWorkHours, setNewWorkHours] = useState<number>(4);

  // Real-time rest-day alert warning state
  const isSelectedDateRestDay = (() => {
    if (!newWorkAssignedId || !newWorkDate) return null;
    const assignedEmp = employees.find(e => e.id === newWorkAssignedId);
    if (!assignedEmp) return null;
    
    try {
      const targetDate = parseDate(newWorkDate);
      const statusInfo = getEmployeeDayStatus(assignedEmp, targetDate, vacations || []);
      if (statusInfo.type !== 'work') {
        return {
          empName: assignedEmp.name.split(' ')[0],
          typeLabel: statusInfo.type === 'rest' ? 'выходной день' : statusInfo.type === 'vacation' ? 'день отпуска' : 'больничный'
        };
      }
    } catch {
      return null;
    }
    return null;
  })();

  // Sync to local storage
  useEffect(() => {
    localStorage.setItem('shift_planner_notes', JSON.stringify(notes));
  }, [notes]);

  useEffect(() => {
    localStorage.setItem('shift_planner_additional_works', JSON.stringify(additionalWorks));
  }, [additionalWorks]);

  // Active workers for dropdown selector
  const activeEmployees = employees.filter(e => {
    const currentStatus = e.statusHistory && e.statusHistory.length > 0 
      ? [...e.statusHistory].sort((a,b) => b.timestamp - a.timestamp)[0].status 
      : 'active';
    return currentStatus !== 'fired' && currentStatus !== 'transferred_out';
  });

  const handleAddNote = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNoteText.trim()) return;

    const today = new Date();
    const formattedDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

    const newNote: CustomNote = {
      id: Date.now().toString(),
      text: newNoteText.trim(),
      createdAt: formattedDate
    };

    setNotes([newNote, ...notes]);
    setNewNoteText('');
  };

  const handleDeleteNote = (id: string) => {
    if (confirm('Вы уверены, что хотите удалить эту заметку?')) {
      setNotes(notes.filter(n => n.id !== id));
    }
  };

  const handleAddWork = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newWorkTitle.trim()) return;

    const newWork: AdditionalWork = {
      id: Date.now().toString(),
      title: newWorkTitle.trim(),
      description: newWorkDesc.trim() || undefined,
      assignedTo: newWorkAssignedId || undefined,
      date: newWorkDate || undefined,
      isCompleted: false,
      hoursSpent: newWorkHours || undefined
    };

    setAdditionalWorks([newWork, ...additionalWorks]);
    setNewWorkTitle('');
    setNewWorkDesc('');
    setNewWorkAssignedId('');
    setNewWorkDate('');
    setNewWorkHours(4);
  };

  const handleToggleWorkCompletion = (id: string) => {
    setAdditionalWorks(additionalWorks.map(w => 
      w.id === id ? { ...w, isCompleted: !w.isCompleted } : w
    ));
  };

  const handleDeleteWork = (id: string) => {
    if (confirm('Вы уверены, что хотите удалить эту работу из списка?')) {
      setAdditionalWorks(additionalWorks.filter(w => w.id !== id));
    }
  };

  return (
    <div id="notes-tasks-container" className="grid grid-cols-1 lg:grid-cols-12 gap-6 pt-2">
      
      {/* 1. БЛОК ЗАМЕТОК (Col span 5) */}
      <div className="lg:col-span-5 bg-white rounded-3xl border border-slate-100 shadow-3xs p-6 flex flex-col space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-sans font-extrabold text-base text-slate-800 tracking-tight flex items-center gap-2">
            <FileText className="w-5 h-5 text-indigo-500 shrink-0" />
            Блок заметок
          </h3>
          <span className="text-[10px] bg-indigo-50 text-indigo-700 font-bold px-2 py-0.5 rounded-md font-mono">
            {notes.length} шт.
          </span>
        </div>
        
        <p className="text-xs text-slate-400 font-sans">
          Храните служебную информацию, напоминания о выкладке товара, переоценке и срочных задачах.
        </p>

        {/* Input Form */}
        <form onSubmit={handleAddNote} className="flex gap-2">
          <input
            type="text"
            value={newNoteText}
            onChange={(e) => setNewNoteText(e.target.value)}
            placeholder="Новая заметка для смены..."
            className="flex-1 bg-slate-50 border border-slate-200 focus:bg-white text-xs rounded-xl p-2.5 focus:ring-1 focus:ring-indigo-500 focus:outline-hidden text-slate-700"
            maxLength={180}
          />
          <button
            type="submit"
            className="bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white p-2.5 rounded-xl transition-all cursor-pointer flex items-center justify-center shrink-0"
            title="Добавить заметку"
          >
            <Plus className="w-4 h-4" />
          </button>
        </form>

        {/* Notes list */}
        <div className="space-y-2.5 max-h-[350px] overflow-y-auto pr-1">
          {notes.length === 0 ? (
            <div className="text-center py-6 border border-dashed border-slate-200 rounded-xl text-xs text-slate-400">
              Список заметок пуст. Напишите важные пункты для магазина.
            </div>
          ) : (
            notes.map((note) => (
              <div
                key={note.id}
                className="group relative bg-slate-50/60 border border-slate-100/80 p-3 rounded-xl hover:bg-slate-50 transition-colors flex flex-col gap-1.5"
              >
                <p className="text-xs text-slate-700 font-sans font-medium break-words leading-relaxed pr-6">
                  {note.text}
                </p>
                
                <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono">
                  <span>Добавлено: {note.createdAt.split('-').reverse().join('.')}</span>
                  <button
                    onClick={() => handleDeleteNote(note.id)}
                    className="opacity-0 group-hover:opacity-100 text-rose-500 hover:text-rose-700 p-1 rounded-md hover:bg-rose-50 cursor-pointer transition-all self-end"
                    title="Удалить заметку"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* 2. БЛОК ДОПОЛНИТЕЛЬНЫХ РАБОТ (Col span 7) */}
      <div className="lg:col-span-7 bg-white rounded-3xl border border-slate-100 shadow-3xs p-6 flex flex-col space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-sans font-extrabold text-base text-slate-800 tracking-tight flex items-center gap-2">
            <Briefcase className="w-5 h-5 text-emerald-500 shrink-0" />
            Блок дополнительных работ
          </h3>
          <span className="text-[10px] bg-emerald-50 text-emerald-700 font-bold px-2 py-0.5 rounded-md font-mono">
            {additionalWorks.filter(w => !w.isCompleted).length} активных
          </span>
        </div>

        <p className="text-xs text-slate-400 font-sans font-normal">
          Регистрируйте плановые мероприятия (приемка поставок, переучет, генеральные уборки витрин) с назначением ответственного сотрудника.
        </p>

        {/* Accordion / Dropdown Form to Add Work */}
        <form onSubmit={handleAddWork} className="bg-slate-50/40 border border-slate-250/20 p-4 rounded-2xl flex flex-col gap-3 font-sans">
          <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block">Новое плановое поручение</span>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <input
              type="text"
              required
              value={newWorkTitle}
              onChange={(e) => setNewWorkTitle(e.target.value)}
              placeholder="Название работы (например, Выкладка новой коллекции)"
              className="bg-white border border-slate-200 text-xs rounded-xl p-2 focus:ring-1 focus:ring-emerald-500 focus:outline-hidden"
              maxLength={70}
            />

            <select
              value={newWorkAssignedId}
              onChange={(e) => setNewWorkAssignedId(e.target.value)}
              className="bg-white border border-slate-200 text-xs rounded-xl p-2 focus:ring-1 focus:ring-emerald-500 focus:outline-hidden cursor-pointer"
            >
              <option value="">Назначить ответственного (общее)</option>
              {activeEmployees.map(emp => (
                <option key={emp.id} value={emp.id}>{emp.name} ({emp.position})</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 items-center">
            <input
              type="date"
              value={newWorkDate}
              onChange={(e) => setNewWorkDate(e.target.value)}
              className="bg-white border border-slate-200 text-xs rounded-xl p-2 focus:ring-1 focus:ring-emerald-500 focus:outline-hidden font-mono"
            />

            <div className="flex items-center gap-2 border border-slate-200 bg-white rounded-xl p-1.5 px-2">
              <span className="text-[10px] text-slate-400 font-bold">Часы:</span>
              <input
                type="number"
                min={1}
                max={24}
                value={newWorkHours}
                onChange={(e) => setNewWorkHours(Math.max(1, parseInt(e.target.value) || 1))}
                className="w-full text-xs text-slate-800 focus:outline-hidden font-bold"
              />
            </div>

            <button
              type="submit"
              className="bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white text-xs font-bold py-2 px-4 rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-3xs"
            >
              <Plus className="w-3.5 h-3.5" />
              Добавить работу
            </button>
          </div>

          <input
            type="text"
            value={newWorkDesc}
            onChange={(e) => setNewWorkDesc(e.target.value)}
            placeholder="Описание задачи / особые примечания для персонала..."
            className="bg-white border border-slate-200 text-xs rounded-xl p-2 focus:ring-1 focus:ring-emerald-500 focus:outline-hidden"
            maxLength={120}
          />

          {isSelectedDateRestDay && (
            <div className="bg-amber-50 border border-amber-200 text-amber-900 rounded-xl p-3 text-[11px] leading-snug flex items-start gap-2 font-sans font-medium">
              <span className="text-base select-none leading-none">⚠️</span>
              <div>
                <strong>Внимание:</strong> У сотрудника {isSelectedDateRestDay.empName} запланирован {isSelectedDateRestDay.typeLabel} на эту дату ({newWorkDate.split('-').reverse().join('.')}). Пожалуйста, планируйте дополнительные задачи осмотрительно!
              </div>
            </div>
          )}
        </form>

        {/* Works schedule list */}
        <div className="space-y-2 max-h-[310px] overflow-y-auto pr-1">
          {additionalWorks.length === 0 ? (
            <div className="text-center py-8 border border-dashed border-slate-200 rounded-xl text-xs text-slate-400 font-sans">
              Категория задач пока пуста. Регистрируйте дополнительные работы.
            </div>
          ) : (
            additionalWorks.map((work) => {
              const assignedEmp = employees.find(e => e.id === work.assignedTo);
              return (
                <div
                  key={work.id}
                  className={`border rounded-xl p-3 flex items-start gap-3 transition-all ${
                    work.isCompleted
                      ? 'bg-emerald-50/20 border-emerald-100/40 text-slate-500 opacity-80'
                      : 'bg-white border-slate-100 hover:border-slate-200 text-slate-800'
                  }`}
                >
                  {/* Complete/Incomplete Toggle Checkbox */}
                  <button
                    type="button"
                    onClick={() => handleToggleWorkCompletion(work.id)}
                    className="p-1 rounded-lg hover:bg-slate-100 shrink-0 text-slate-400 hover:text-emerald-500 transition-colors cursor-pointer"
                  >
                    {work.isCompleted ? (
                      <CheckSquare className="w-4 h-4 text-emerald-600" />
                    ) : (
                      <Square className="w-4 h-4" />
                    )}
                  </button>

                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-start justify-between gap-2">
                      <span className={`text-xs font-bold leading-tight ${work.isCompleted ? 'line-through text-slate-400' : 'text-slate-800'}`}>
                        {work.title}
                      </span>
                      
                      <button
                        onClick={() => handleDeleteWork(work.id)}
                        className="text-slate-400 hover:text-rose-600 p-0.5 rounded cursor-pointer transition-colors"
                        title="Удалить задачу"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {work.description && (
                      <p className="text-[11px] text-slate-450 leading-relaxed font-sans font-medium">
                        {work.description}
                      </p>
                    )}

                    <div className="flex items-center gap-2.5 flex-wrap text-[10px] text-slate-400 font-sans pt-0.5">
                      {assignedEmp ? (
                        <span className="flex items-center gap-1 text-slate-500 font-semibold bg-slate-50 border border-slate-100 rounded-full px-2 py-0.5">
                          <UserCircle className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          Ответственный: {assignedEmp.name.split(' ')[0]}
                        </span>
                      ) : (
                        <span className="text-amber-600 bg-amber-50/50 rounded-full px-2 py-0.5 border border-amber-100/20">Вся смена</span>
                      )}

                      {work.date && (
                        <span className="flex items-center gap-1 font-mono">
                          <Calendar className="w-3.5 h-3.5" />
                          {work.date.split('-').reverse().join('.')}
                        </span>
                      )}

                      {work.hoursSpent && (
                        <span className="bg-slate-100/60 text-slate-500 font-bold px-1.5 py-0.5 rounded font-mono">
                          {work.hoursSpent} ч.
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

    </div>
  );
};
