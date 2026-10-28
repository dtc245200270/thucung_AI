import React, { useState } from 'react';
import { 
  Menu, 
  Bell, 
  Search, 
  Command,
  HeartHandshake,
  LayoutDashboard,
  PawPrint,
  CalendarDays,
  Activity,
  Stethoscope,
  DollarSign,
  Scan
} from 'lucide-react';
import { NotificationDropdown } from './NotificationDropdown';
import { DayNightSwitch } from '../common/DayNightSwitch';
import { sound } from '../../services/soundService';
import { getTodayVnDate, getVnDateString } from '../../utils/dateUtils.js';
import { useCurrentVnDate } from '../../hooks/useCurrentVnDate';

export const Navbar = ({ 
  pets = [], 
  schedules = [],
  activeTab = 'dashboard',
  setActiveTab = () => {},
  theme,
  onToggleTheme,
  onToggleComplete,
  onOpenGlobalSearch = () => {},
  onToggleMobileMenu = () => {}
}) => {
  const [isNotifOpen, setIsNotifOpen] = useState(false);

  const todayStr = useCurrentVnDate();
  const urgentCount = schedules.filter(s => s && s.date && (getVnDateString(s.date) <= todayStr) && !s.completed).length;

  // 1. Khai báo mảng 7 Menu Items chuẩn hóa
  const navItems = [
    { id: 'dashboard', label: 'Tổng quan', icon: LayoutDashboard },
    { id: 'pets', label: 'Thú cưng', icon: PawPrint },
    { id: 'schedule', label: 'Lịch trình', icon: CalendarDays },
    { id: 'bonding', label: 'Hoạt động & Nhật ký', icon: Activity },
    { id: 'medical', label: 'Hồ sơ sức khỏe', icon: Stethoscope },
    { id: 'expenses', label: 'Chi tiêu', icon: DollarSign },
    { id: 'ai-vision', label: 'AI quan sát ảnh', icon: Scan }
  ];

  return (
    <header 
      className="fixed top-4 left-1/2 -translate-x-1/2 w-[96%] max-w-[1400px] h-[64px] bg-white/95 dark:bg-slate-900/90 backdrop-blur-md rounded-full shadow-sm border border-[#E2E8F0] dark:border-white/10 flex items-center justify-between px-4 z-50 select-none"
      aria-label="Thanh điều hướng trên cùng dạng viên nang nổi"
    >
      {/* 1. LEFT (VÙNG 1): Mobile Drawer Toggle & PetCare Logo */}
      <div className="flex items-center gap-3 min-w-0 shrink-0">
        <button
          type="button"
          onClick={onToggleMobileMenu}
          className="p-2 -ml-2 rounded-xl text-[#475569] dark:text-slate-400 hover:text-[#0F172A] dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/10 lg:hidden transition-colors cursor-pointer shrink-0 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-indigo-500"
          aria-label="Mở menu điều hướng"
          title="Mở menu"
        >
          <Menu className="w-5 h-5" />
        </button>

        {/* PetCare Logo */}
        <div className="flex items-center gap-2.5 shrink-0">
          <div className="w-9 h-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-xs">
            <HeartHandshake className="w-5 h-5" />
          </div>
          <span className="font-extrabold text-base tracking-tight text-[#0F172A] dark:text-white">
            PetCare
          </span>
        </div>
      </div>

      {/* 2. CENTER (VÙNG 2): MENU CHÍNH GIỮA (FLOATING PILL MENU) */}
      <div className="hidden lg:flex items-center gap-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;

          return (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                try { sound?.playClick?.(); } catch {}
                setActiveTab(item.id);
              }}
              className={
                isActive
                  ? 'px-5 py-2 text-[13px] font-bold bg-indigo-600 text-white rounded-full shadow-md shadow-indigo-500/25 cursor-pointer flex items-center gap-1.5'
                  : 'px-4 py-2 text-[13px] font-bold text-[#475569] hover:text-[#0F172A] dark:text-slate-400 dark:hover:text-white transition-colors cursor-pointer flex items-center gap-1.5'
              }
            >
              <Icon className="w-4 h-4 shrink-0" />
              <span>{item.label}</span>
            </button>
          );
        })}
      </div>

      {/* 3. RIGHT (VÙNG 3): CAPSULE UTILITIES (SEARCH, DAY/NIGHT TOGGLE, NOTIFICATIONS) */}
      <div className="flex items-center gap-2.5 sm:gap-3 shrink-0">
        
        {/* Working Global Search trigger (Ctrl+K / ⌘K) inside glass capsule */}
        <button
          type="button"
          onClick={onOpenGlobalSearch}
          className="min-h-[40px] h-10 sm:h-11 flex items-center gap-2 bg-[#F8FAFC] dark:bg-slate-800/80 border border-[#E2E8F0] dark:border-white/10 rounded-full px-3.5 sm:px-4 text-xs sm:text-sm text-[#475569] dark:text-slate-200 hover:text-[#0F172A] dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-700/80 transition-all cursor-pointer group shadow-xs focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-indigo-500"
          title="Tìm kiếm hồ sơ thú cưng, lịch trình, chi tiêu (⌘K)"
          aria-label="Tìm kiếm nhanh toàn hệ thống"
        >
          <Search className="w-4 h-4 text-[#475569] dark:text-slate-400 group-hover:text-[#0F172A] dark:group-hover:text-white transition-colors shrink-0" />
          <span className="hidden sm:inline font-medium">Tìm kiếm...</span>
          <kbd className="hidden md:inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-white dark:bg-slate-700 text-[10px] font-mono text-[#475569] dark:text-slate-300 border border-[#E2E8F0] dark:border-white/10">
            <Command className="w-2.5 h-2.5" /> K
          </kbd>
        </button>

        {/* Day/Night Theme Toggle */}
        <div className="flex items-center">
          <DayNightSwitch
            isDark={theme === 'dark'}
            onToggle={onToggleTheme}
          />
        </div>

        {/* Notifications Bell in capsule rounded-full */}
        <div className="relative">
          <button
            type="button"
            onClick={() => {
              try { sound?.playPop?.(); } catch {}
              setIsNotifOpen(!isNotifOpen);
            }}
            className="w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-[#F8FAFC] dark:bg-slate-800/80 border border-[#E2E8F0] dark:border-white/10 shadow-xs flex items-center justify-center text-[#475569] dark:text-slate-200 hover:text-[#0F172A] dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-700/80 transition-colors relative cursor-pointer focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-indigo-500"
            title="Thông báo lịch trình"
            aria-label="Thông báo"
            aria-expanded={isNotifOpen}
          >
            <Bell className="w-4 h-4 text-[#475569] dark:text-slate-300" />
            {urgentCount > 0 && (
              <span 
                className="absolute top-2 right-2 w-2 h-2 rounded-full bg-rose-500 ring-2 ring-white dark:ring-slate-900" 
                aria-label={`Có ${urgentCount} thông báo cần xử lý`}
              />
            )}
          </button>

          {isNotifOpen && (
            <NotificationDropdown
              schedules={schedules}
              pets={pets}
              onClose={() => setIsNotifOpen(false)}
              onToggleComplete={onToggleComplete}
            />
          )}
        </div>

      </div>
    </header>
  );
};

export default Navbar;

