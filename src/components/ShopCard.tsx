/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Store, Edit3, Save, Clock, CalendarDays } from 'lucide-react';
import { ShopDetails } from '../types';

interface ShopCardProps {
  shop: ShopDetails;
  onUpdateShop: (updated: ShopDetails) => void;
  year: number;
  monthIndex: number;
  totalTeamHours: number;
  totalTeamDays: number;
  isRangeFilterActive?: boolean;
}

export const ShopCard: React.FC<ShopCardProps> = ({
  shop,
  onUpdateShop,
  year,
  monthIndex,
  totalTeamHours,
  totalTeamDays,
  isRangeFilterActive = false,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editedName, setEditedName] = useState(shop.name);
  const [editedAddress, setEditedAddress] = useState(shop.address || '');

  const handleSave = () => {
    onUpdateShop({
      ...shop,
      name: editedName.trim() || 'Мой Магазин',
      address: editedAddress.trim(),
    });
    setIsEditing(false);
  };

  return (
    <div id="shop-card" className="bg-white rounded-2xl border border-slate-100 shadow-xs p-6 hover:shadow-md transition-shadow duration-300">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl">
            <Store className="w-6 h-6" />
          </div>
          <div>
            {isEditing ? (
              <input
                id="shop-name-input"
                type="text"
                value={editedName}
                onChange={(e) => setEditedName(e.target.value)}
                className="font-sans font-semibold text-lg text-slate-800 border-b-2 border-indigo-500 focus:outline-hidden py-0.5"
                maxLength={40}
                placeholder="Название магазина"
              />
            ) : (
              <h2 id="shop-title" className="font-sans font-bold text-xl text-slate-800 tracking-tight flex items-center gap-2">
                {shop.name}
              </h2>
            )}
            {isEditing ? (
              <input
                id="shop-address-input"
                type="text"
                value={editedAddress}
                onChange={(e) => setEditedAddress(e.target.value)}
                className="text-xs text-slate-500 block border-b border-indigo-300 focus:outline-hidden mt-1 w-full"
                placeholder="Адрес магазина"
                maxLength={100}
              />
            ) : (
              <p className="text-xs text-slate-500 mt-0.5 font-mono">
                {shop.address || 'Адрес не указан • Регион РФ'}
              </p>
            )}
          </div>
        </div>

        <div>
          {isEditing ? (
            <button
              id="shop-save-btn"
              onClick={handleSave}
              className="p-2 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors cursor-pointer"
              title="Сохранить"
            >
              <Save className="w-5 h-5" />
            </button>
          ) : (
            <button
              id="shop-edit-btn"
              onClick={() => {
                setEditedName(shop.name);
                setEditedAddress(shop.address || '');
                setIsEditing(true);
              }}
              className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-slate-50 rounded-lg transition-colors cursor-pointer"
              title="Редактировать магазин"
            >
              <Edit3 className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>

      {/* Operating Schedule */}
      <div className="mt-4 pt-4 border-t border-slate-100 space-y-3">
        <div className="bg-slate-50/60 rounded-xl p-3 space-y-2">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block font-sans">
            График работы магазина
          </span>
          <div className="grid grid-cols-1 gap-2.5 text-xs">
            <div className="bg-indigo-50/40 border border-indigo-100/30 p-2.5 rounded-lg">
              <span className="font-bold text-indigo-950 flex items-center gap-1 mb-1">
                ❄️ Зимний период (01.10 – 31.03):
              </span>
              <ul className="space-y-0.5 text-slate-600 font-sans font-medium text-[11px]">
                <li className="flex justify-between"><span>Пн – Пт:</span> <strong className="text-slate-800">9:00 – 20:00</strong></li>
                <li className="flex justify-between"><span>Сб и Праздники:</span> <strong className="text-slate-800">9:00 – 19:00</strong></li>
                <li className="flex justify-between"><span>Воскресенье:</span> <strong className="text-slate-800">10:00 – 18:00</strong></li>
              </ul>
            </div>

            <div className="bg-amber-50/40 border border-amber-100/30 p-2.5 rounded-lg">
              <span className="font-bold text-amber-950 flex items-center gap-1 mb-1">
                ☀️ Летний период (01.04 – 30.09):
              </span>
              <ul className="space-y-0.5 text-slate-600 font-sans font-medium text-[11px]">
                <li className="flex justify-between"><span>Пн – Пт:</span> <strong className="text-slate-800">9:00 – 19:00</strong></li>
                <li className="flex justify-between"><span>Сб и Праздники:</span> <strong className="text-slate-800">9:00 – 19:00</strong></li>
                <li className="flex justify-between"><span>Воскресенье:</span> <strong className="text-slate-800">10:00 – 18:00</strong></li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* Aggregate Stats for the month */}
      <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between text-xs font-mono text-slate-500">
        <span className="flex items-center gap-1">
          <CalendarDays className="w-3.5 h-3.5 text-slate-400" />
          {isRangeFilterActive ? 'Смен команды за период:' : 'Всего смен команды:'}
        </span>
        <span className="font-bold text-slate-700">{totalTeamDays} дн.</span>
      </div>
      <div className="mt-1 flex items-center justify-between text-xs font-mono text-slate-500">
        <span className="flex items-center gap-1">
          <Clock className="w-3.5 h-3.5 text-slate-400" />
          {isRangeFilterActive ? 'Часов команды за период:' : 'Всего часов команды:'}
        </span>
        <span className="font-bold text-indigo-600">{totalTeamHours} ч.</span>
      </div>
    </div>
  );
};
