import React from 'react';
import { 
  Menu, 
  Search, 
  Command,
  Building2,
  Stethoscope
} from 'lucide-react';
import { DayNightSwitch } from '../common/DayNightSwitch';
import { sound } from '../../services/soundService';

export const VetNavbar = ({ 
  activeTab = 'dashboard',
  theme = 'dark',
  onToggleTheme = () => {},
  onToggleMobileMenu = () => {},
  onOpenGlobalSearch = () => {},
  currentUser = null
}) => {
  const pageTitles = {
    dashboard: 'Tổng quan phòng khám',
    appointments: 'Hàng đợi & Lịch khám',
    patients: 'Hồ sơ bệnh nhân',
    soap: 'Khám bệnh lâm sàng (SOAP)',
    schedule: 'Lịch làm việc bác sĩ'
  };

  const currentTitle = pageTitles[activeTab] || 'Phân hệ Bác sĩ Thú y';
  const facilityName = currentUser?.facility || currentUser?.clinicName || '';
  const facilityAddress = currentUser?.address || '';

  return (
    <header 
      className="h-16 shrink-0 z-20 sticky top-0 bg-[#EEF4F0]/80 dark:bg-[#121714]/80 backdrop-blur-md border-b border-[#E5E7EB]/70 dark:border-[#344039]/70 px-4 sm:px-6 lg:px-8 flex items-center justify-between gap-4 transition-colors select-none"
      aria-label="Thanh điều hướng Bác sĩ"
    >
      {/* 1. LEFT: Mobile Drawer Toggle & Dynamic Page Title */}
      <div className="flex items-center gap-3 min-w-0">
        <button
          type="button"
          onClick={onToggleMobileMenu}
          className="p-2 -ml-2 rounded-xl text-[#64716B] dark:text-[#9AA8A0] hover:text-[#18201D] dark:hover:text-[#F1F5F2] hover:bg-white/60 dark:hover:bg-[#1D2520] md:hidden transition-colors cursor-pointer shrink-0 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-[#202421]"
          aria-label="Mở menu điều hướng Bác sĩ"
          title="Mở menu"
        >
          <Menu className="w-5 h-5" />
        </button>

        {/* Brand logo & portal mark */}
        <div className="flex items-center gap-2.5 shrink-0">
          <div className="w-9 h-9 rounded-xl bg-[#202421] text-white flex items-center justify-center shadow-xs">
            <Building2 className="w-5 h-5 text-emerald-400" />
          </div>
          <span className="font-extrabold text-base tracking-tight text-[#18201D] dark:text-[#F1F5F2]">
            Clinic OS
          </span>
        </div>

        <span className="hidden sm:inline-block h-4 w-px bg-[#E5E7EB] dark:bg-[#344039] mx-1" />

        <div className="min-w-0">
          <h1 className="text-lg sm:text-xl font-bold text-[#18201D] dark:text-[#F1F5F2] tracking-tight truncate flex items-center gap-2">
            <span>{currentTitle}</span>
          </h1>
          {facilityName && (
            <p className="text-[11px] text-[#64716B] dark:text-[#9AA8A0] truncate hidden sm:block">
              {facilityName} {facilityAddress ? `• ${facilityAddress}` : ''}
            </p>
          )}
        </div>
      </div>

      {/* 2. RIGHT: Capsule Search, Theme switch, Doctor badge */}
      <div className="flex items-center gap-2.5 sm:gap-3 shrink-0">
        {/* Working Global Search trigger inside white capsule */}
        <button
          type="button"
          onClick={onOpenGlobalSearch}
          className="min-h-[40px] h-10 sm:h-11 flex items-center gap-2 bg-white dark:bg-[#1D2520] border border-[#E5E7EB] dark:border-[#344039] rounded-full px-3.5 sm:px-4 text-xs sm:text-sm text-[#64716B] dark:text-[#9AA8A0] hover:border-[#202421]/30 dark:hover:border-white/30 transition-all cursor-pointer group shadow-xs focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-[#202421]"
          title="Tìm kiếm hồ sơ bệnh nhân, lịch khám (⌘K)"
          aria-label="Tìm kiếm nhanh toàn hệ thống"
        >
          <Search className="w-4 h-4 text-[#64716B] dark:text-[#9AA8A0] group-hover:text-[#18201D] dark:group-hover:text-white transition-colors shrink-0" />
          <span className="hidden sm:inline font-medium">Tìm kiếm...</span>
          <kbd className="hidden md:inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-[#EEF4F0] dark:bg-[#252E28] text-[10px] font-mono text-[#64716B] dark:text-[#9AA8A0] border border-[#E5E7EB] dark:border-[#344039]">
            <Command className="w-2.5 h-2.5" /> K
          </kbd>
        </button>

        {/* Day/Night Theme Toggle */}
        <DayNightSwitch
          isDark={theme === 'dark'}
          onToggle={onToggleTheme}
        />

        {/* Doctor Role Capsule Badge */}
        <div className="hidden sm:flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white dark:bg-[#1D2520] border border-[#E5E7EB] dark:border-[#344039] shadow-xs text-[#18201D] dark:text-[#F1F5F2]">
          <Stethoscope className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
          <span className="text-xs font-bold font-mono">
            {currentUser?.name || 'Bác sĩ Thú y'}
          </span>
        </div>
      </div>
    </header>
  );
};

export default VetNavbar;

