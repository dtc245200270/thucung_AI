import React from 'react';
import { 
  Bell, 
  CheckCircle2, 
  Clock, 
  AlertTriangle, 
  CalendarCheck2, 
  X,
  PawPrint
} from 'lucide-react';
import { ScheduleBadge } from '../common/Badges';
import { getTodayVnDate, getVnDateString } from '../../utils/dateUtils.js';
import { useCurrentVnDate } from '../../hooks/useCurrentVnDate';

export const NotificationDropdown = ({
  isOpen,
  onClose,
  schedules = [],
  pets = [],
  onToggleComplete,
  onNavigateTab
}) => {
  const todayStr = useCurrentVnDate();

  if (!isOpen) return null;
  const overdueItems = schedules.filter(s => s && s.date && getVnDateString(s.date) < todayStr && !s.completed);
  const todayItems = schedules.filter(s => s && s.date && getVnDateString(s.date) === todayStr && !s.completed);

  return (
    <div className="absolute right-0 top-14 z-50 w-80 sm:w-96 bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-[#E2E8F0] dark:border-white/10 p-4 animate-in fade-in zoom-in-95 duration-150 text-[#1E293B] dark:text-white">
      
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-[#E2E8F0] dark:border-white/10 mb-3">
        <div className="flex items-center gap-2">
          <Bell className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
          <h3 className="text-xs font-bold uppercase tracking-wider text-[#0F172A] dark:text-white">
            Thông Báo Lịch Nhắc Nhở
          </h3>
        </div>
        <button
          onClick={onClose}
          className="p-1 text-[#475569] hover:text-[#0F172A] dark:text-slate-400 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-white/10 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Content */}
      <div className="max-h-80 overflow-y-auto space-y-2.5 pr-1 text-xs custom-scrollbar">
        {overdueItems.length === 0 && todayItems.length === 0 ? (
          <div className="py-8 text-center text-[#475569] dark:text-slate-400">
            <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2 opacity-80" />
            <p className="font-bold text-[#0F172A] dark:text-slate-200">Không có việc nào gấp!</p>
            <p className="text-[11px] text-[#475569] dark:text-slate-400 mt-0.5">Tất cả lịch tiêm và chăm sóc hôm nay đã hoàn tất.</p>
          </div>
        ) : (
          <>
            {/* Overdue */}
            {overdueItems.length > 0 && (
              <div className="space-y-1.5">
                <div className="text-[10px] font-bold text-rose-600 dark:text-rose-400 uppercase flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" /> Cần làm ngay (Quá hạn {overdueItems.length})
                </div>
                {overdueItems.map(item => {
                  const pet = pets.find(p => p.id === item.petId);

                  return (
                    <div 
                      key={item.id}
                      className="p-2.5 rounded-xl bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/20 flex items-start justify-between gap-2"
                    >
                      <div>
                        <div className="font-bold text-rose-950 dark:text-rose-200">{item.title}</div>
                        <div className="text-[11px] text-rose-700 dark:text-rose-300 flex items-center gap-1 mt-0.5">
                          <span>Bé: {pet ? pet.name : 'Pet'}</span> • <span>Hạn: {item.date}</span>
                        </div>
                      </div>
                      <button
                        onClick={() => onToggleComplete(item.id)}
                        className="px-2 py-1 rounded-lg bg-rose-600 text-white font-bold text-[10px] hover:bg-rose-700 shrink-0 cursor-pointer shadow-xs"
                      >
                        Xong
                      </button>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Today */}
            {todayItems.length > 0 && (
              <div className="space-y-1.5 pt-2">
                <div className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase flex items-center gap-1">
                  <CalendarCheck2 className="w-3 h-3" /> Hôm nay ({todayItems.length})
                </div>
                {todayItems.map(item => {
                  const pet = pets.find(p => p.id === item.petId);

                  return (
                    <div 
                      key={item.id}
                      className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 flex items-start justify-between gap-2"
                    >
                      <div>
                        <div className="font-bold text-emerald-950 dark:text-emerald-200">{item.title}</div>
                        <div className="text-[11px] text-emerald-700 dark:text-emerald-300 flex items-center gap-1 mt-0.5">
                          <span>Bé: {pet ? pet.name : 'Pet'}</span> • <span>Giờ: {item.time || 'Cả ngày'}</span>
                        </div>
                      </div>
                      <button
                        onClick={() => onToggleComplete(item.id)}
                        className="px-2 py-1 rounded-lg bg-emerald-600 text-white font-bold text-[10px] hover:bg-emerald-700 shrink-0 cursor-pointer shadow-xs"
                      >
                        Xong
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>

      {/* Footer */}
      <div className="pt-3 border-t border-[#E2E8F0] dark:border-white/10 mt-2 text-center">
        <button
          onClick={() => {
            onClose();
            onNavigateTab('schedule');
          }}
          className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
        >
          Xem Toàn Bộ Lịch Chăm Sóc ➜
        </button>
      </div>

    </div>
  );
};
