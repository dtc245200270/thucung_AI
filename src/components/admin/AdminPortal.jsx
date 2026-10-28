import React, { useState } from 'react';
import { 
  LayoutDashboard, 
  Users, 
  HardDrive, 
  ShieldCheck, 
  LogOut, 
  Menu, 
  X, 
  ExternalLink,
  ChevronRight,
  Shield,
  Activity,
  Calendar, 
  Bot, 
  FileText,
  PanelLeftClose,
  PanelLeftOpen
} from 'lucide-react';
import { AdminOverviewView } from './AdminOverviewView';
import { AdminAccountsView } from './AdminAccountsView';
import { AdminBackupView } from './AdminBackupView';
import { DayNightSwitch } from '../common/DayNightSwitch';
import { useTheme } from '../../context/ThemeContext';
import { sound } from '../../services/soundService';
import { AdminAuditLogsView } from './AdminAuditLogsView';
import { AdminAiDocsView } from './AdminAiDocsView';
import { VetAppointmentsAdminView } from '../booking/VetAppointmentsAdminView';

export const AdminPortal = ({
  currentUser,
  users = [],
  usersLoading = false,
  usersError = null,
  onRetryLoadUsers = null,
  pets = [],
  schedules = [],
  appointments = [],
  onUpdateAppointment,
  onDeleteAppointment,
  onOpenCreateBooking,
  onLogout,
  onSwitchPortal,
  onUsersUpdated,
  onDataChanged
}) => {
  const [activeTab, setActiveTab] = useState('overview'); // 'overview' | 'accounts' | 'appointments' | 'docs' | 'audit' | 'backup'
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { theme, isDark, toggleTheme } = useTheme();

  const navItems = [
    {
      id: 'overview',
      label: 'Tổng quan hệ thống',
      icon: LayoutDashboard,
      badge: null
    },
    {
      id: 'accounts',
      label: 'Quản lý tài khoản',
      icon: Users,
      badge: null
    },
    {
      id: 'appointments',
      label: 'Lịch khám & Phân công',
      icon: Calendar,
      badge: (appointments || []).filter(a => a.status === 'Chờ duyệt' || a.status === 'pending').length || null
    },
    {
      id: 'docs',
      label: 'Tri thức AI & FAQ',
      icon: FileText,
      badge: null
    },
    {
      id: 'audit',
      label: 'Nhật ký kiểm toán',
      icon: Activity,
      badge: null
    },
    {
      id: 'backup',
      label: 'Sao lưu & Khôi phục',
      icon: HardDrive,
      badge: null
    }
  ];

  const handleNavClick = (tabId) => {
    sound?.playClick?.();
    setActiveTab(tabId);
    setIsMobileMenuOpen(false);
  };

  const renderNavContent = (isMobile = false) => {
    const collapsed = !isMobile && isSidebarCollapsed;

    return (
      <div className="flex flex-col h-full justify-between select-none bg-[#202421] text-white rounded-[28px] overflow-hidden">
        {/* TOP: Header & Collapse/Close */}
        <div className="shrink-0 p-2 border-b border-[#2D332F]">
          <div className={`h-11 flex items-center ${
            collapsed ? 'justify-center' : 'justify-between px-2'
          }`}>
            {!collapsed && (
              <div className="flex items-center gap-2 min-w-0">
                <span className="font-extrabold text-sm text-white tracking-tight">
                  Quản trị
                </span>
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-white/10 text-indigo-400">
                  SYSTEM
                </span>
              </div>
            )}

            {isMobile ? (
              <button
                type="button"
                onClick={() => setIsMobileMenuOpen(false)}
                className="min-h-[44px] min-w-[44px] w-11 h-11 rounded-2xl flex items-center justify-center text-[#9AA8A0] hover:text-white hover:bg-[#2A302B] transition-colors cursor-pointer"
                aria-label="Đóng menu điều hướng"
                title="Đóng menu"
              >
                <X className="w-5 h-5" />
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  try { sound?.playClick?.(); } catch {}
                  setIsSidebarCollapsed(prev => !prev);
                }}
                className={`min-h-[44px] min-w-[44px] w-11 h-11 rounded-2xl flex items-center justify-center text-[#9AA8A0] hover:text-white hover:bg-[#2A302B] transition-colors cursor-pointer ${
                  collapsed ? 'w-full' : ''
                }`}
                aria-label={collapsed ? "Mở rộng thanh điều hướng (224px)" : "Thu gọn thanh điều hướng (64px)"}
                title={collapsed ? "Mở rộng menu (224px)" : "Thu gọn menu (64px)"}
              >
                {collapsed ? <PanelLeftOpen className="w-5 h-5" /> : <PanelLeftClose className="w-5 h-5" />}
              </button>
            )}
          </div>
        </div>

        {/* MIDDLE: Navigation Items List */}
        <nav 
          className="p-2 space-y-1.5 flex-1 overflow-y-auto custom-scrollbar"
          aria-label="Danh mục chức năng Quản trị"
        >
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;

            return (
              <div key={item.id} className="relative group">
                <button
                  type="button"
                  onClick={() => handleNavClick(item.id)}
                  className={`w-full min-h-[44px] h-11 flex items-center rounded-2xl text-[14px] font-semibold transition-all relative cursor-pointer focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-indigo-400 ${
                    collapsed 
                      ? 'justify-center px-0' 
                      : 'justify-start px-3 gap-3'
                  } ${
                    isActive
                      ? 'bg-[#343D36] text-white font-bold shadow-xs'
                      : 'text-[#9AA8A0] hover:text-white hover:bg-[#2A302B]'
                  }`}
                  aria-label={item.label}
                  aria-current={isActive ? 'page' : undefined}
                  title={collapsed ? item.label : undefined}
                >
                  {/* Active Indicator Bar */}
                  {isActive && (
                    <span 
                      className={`absolute rounded-full bg-indigo-400 transition-all ${
                        collapsed ? 'left-1 top-3 bottom-3 w-1' : 'left-1.5 top-2.5 bottom-2.5 w-1'
                      }`}
                      aria-hidden="true" 
                    />
                  )}

                  <Icon className={`w-[22px] h-[22px] shrink-0 transition-transform duration-150 group-hover:scale-105 ${
                    isActive ? 'text-white' : 'text-[#9AA8A0] group-hover:text-white'
                  }`} />

                  {/* Label when expanded */}
                  {!collapsed && (
                    <span className="truncate text-left flex-1 text-[14px]">
                      {item.label}
                    </span>
                  )}

                  {/* Badge when expanded */}
                  {!collapsed && item.badge && (
                    <span className={`px-2 py-0.5 rounded-full text-xs font-bold font-mono ml-auto ${
                      isActive
                        ? 'bg-white/20 text-white'
                        : 'bg-amber-500 text-white'
                    }`}>
                      {item.badge}
                    </span>
                  )}

                  {/* Dot badge on collapsed mode */}
                  {collapsed && item.badge && (
                    <span 
                      className="absolute top-2.5 right-2.5 w-2 h-2 rounded-full bg-amber-400 ring-2 ring-[#202421]" 
                      aria-hidden="true"
                    />
                  )}
                </button>

                {/* Floating Tooltip when Collapsed */}
                {collapsed && (
                  <div 
                    role="tooltip"
                    className="absolute left-full ml-3 top-1/2 -translate-y-1/2 px-2.5 py-1.5 rounded-xl bg-[#202421] text-white text-xs font-semibold whitespace-nowrap shadow-xl opacity-0 pointer-events-none group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity duration-150 z-50 border border-[#2D332F] flex items-center gap-2"
                  >
                    <span>{item.label}</span>
                    {item.badge && (
                      <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold font-mono bg-amber-500 text-white">
                        {item.badge}
                      </span>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        {/* BOTTOM: System Mode Info Card */}
        <div className="p-2 border-t border-[#2D332F] shrink-0">
          {!collapsed ? (
            <div className="p-3 rounded-2xl bg-[#2A302B] text-xs space-y-1.5 border border-[#343D36]">
              <div className="flex items-center gap-1.5 text-indigo-400 font-bold">
                <Shield className="w-3.5 h-3.5" />
                <span>Chế độ Quản Trị</span>
              </div>
              <p className="text-[11px] text-[#9AA8A0] leading-snug">
                Quyền hạn cấp cao nhất. Mọi thao tác có hiệu lực ngay lập tức.
              </p>
            </div>
          ) : (
            <div className="flex justify-center py-2" title="Chế độ Quản Trị Hệ Thống">
              <div className="w-9 h-9 rounded-xl bg-[#2A302B] text-indigo-400 flex items-center justify-center border border-[#343D36]">
                <Shield className="w-4 h-4" />
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="h-screen w-full flex flex-col overflow-hidden antialiased bg-[#EEF4F0] dark:bg-[#121714] text-[#18201D] dark:text-[#F1F5F2]">
      
      {/* ============================================================ */}
      {/* 1. TOP ADMIN HEADER BAR (64px, CAPSULE UTILITIES)            */}
      {/* ============================================================ */}
      <header className="h-16 shrink-0 z-40 w-full px-4 sm:px-6 bg-[#EEF4F0]/80 dark:bg-[#121714]/80 backdrop-blur-md border-b border-[#E5E7EB] dark:border-[#344039] flex items-center justify-between gap-4">
        
        {/* Left: Mobile Menu Button & Brand Logo/Title */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="p-2 rounded-2xl md:hidden text-[#64716B] dark:text-[#9AA8A0] hover:bg-black/5 dark:hover:bg-white/[0.06] transition-colors cursor-pointer"
            aria-label="Mở menu quản trị"
          >
            {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>

          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#202421] text-white flex items-center justify-center font-bold shadow-sm shrink-0 border border-[#2D332F]">
              <ShieldCheck className="w-5 h-5 text-indigo-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-base tracking-tight text-[#18201D] dark:text-[#F1F5F2]">
                  PetCare Admin
                </span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-400/30">
                  SYSTEM CORE
                </span>
              </div>
              <p className="text-[11px] text-[#64716B] dark:text-[#9AA8A0] hidden sm:block">Hệ thống phân quyền & kiểm soát dữ liệu</p>
            </div>
          </div>
        </div>

        {/* Right: Switch Portal, Day/Night, Profile & Logout capsules */}
        <div className="flex items-center gap-2 sm:gap-3">
          
          {/* Day/Night switch capsule */}
          <DayNightSwitch
            isDark={isDark}
            onToggle={toggleTheme}
          />

          {/* Nút Xem thử Cổng Người Dùng */}
          <button
            type="button"
            onClick={() => {
              sound?.playClick?.();
              if (onSwitchPortal) onSwitchPortal('OWNER');
            }}
            className="hidden sm:flex items-center gap-1.5 h-10 px-3.5 rounded-full text-xs font-semibold bg-white dark:bg-[#1D2520] hover:bg-slate-50 dark:hover:bg-[#252F29] border border-[#E5E7EB] dark:border-[#344039] text-[#18201D] dark:text-[#F1F5F2] shadow-2xs transition-all cursor-pointer"
            title="Chuyển sang xem thử giao diện Chủ Nuôi"
          >
            <span>Cổng Người Dùng</span>
            <ExternalLink className="w-3.5 h-3.5 text-indigo-500" />
          </button>

          {/* Admin Profile Capsule */}
          <div className="flex items-center gap-2 h-10 px-3 rounded-full bg-white dark:bg-[#1D2520] border border-[#E5E7EB] dark:border-[#344039] shadow-2xs">
            <img 
              src={currentUser?.avatar || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=300&auto=format&fit=crop&q=80"} 
              alt="Admin Avatar"
              className="w-6 h-6 rounded-full object-cover border border-[#E5E7EB] dark:border-[#344039]" 
            />
            <div className="text-left hidden lg:block leading-tight">
              <p className="text-xs font-bold text-[#18201D] dark:text-[#F1F5F2] truncate max-w-[120px]">
                {currentUser?.name || "Admin"}
              </p>
            </div>
          </div>

          {/* Logout button capsule */}
          <button
            type="button"
            onClick={onLogout}
            title="Đăng xuất khỏi hệ thống"
            className="h-10 w-10 rounded-full flex items-center justify-center text-[#64716B] dark:text-[#9AA8A0] hover:text-rose-600 dark:hover:text-rose-400 bg-white dark:bg-[#1D2520] hover:bg-rose-50 dark:hover:bg-rose-950/40 border border-[#E5E7EB] dark:border-[#344039] transition-colors cursor-pointer shadow-2xs"
          >
            <LogOut className="w-4 h-4" />
          </button>

        </div>

      </header>

      {/* ============================================================ */}
      {/* 2. BODY LAYOUT: FLOATING DARK SIDEBAR + MAIN WORKSPACE       */}
      {/* ============================================================ */}
      <div className="flex-1 min-h-0 flex overflow-hidden">
        
        {/* Desktop Admin Floating Sidebar: 64px collapsed, 224px expanded, rounded-28px, 16px from left */}
        <aside 
          className={`hidden md:flex flex-col shrink-0 my-2 ml-4 mb-4 rounded-[28px] shadow-lg border border-[#2D332F] z-30 transition-all duration-200 ease-in-out select-none ${
            isSidebarCollapsed ? 'w-[64px]' : 'w-[224px]'
          }`}
          style={{ height: 'calc(100vh - 80px)' }}
          aria-label="Thanh điều hướng Quản trị"
        >
          {renderNavContent(false)}
        </aside>

        {/* Mobile Sidebar Drawer */}
        {isMobileMenuOpen && (
          <div 
            className="fixed inset-0 z-50 md:hidden flex"
            role="dialog"
            aria-modal="true"
          >
            {/* Backdrop */}
            <div 
              className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity animate-in fade-in duration-200"
              onClick={() => setIsMobileMenuOpen(false)}
            />
            {/* Drawer content */}
            <div className="relative w-72 max-w-[85vw] h-full bg-[#202421] text-white rounded-r-[28px] border-r border-[#2D332F] shadow-2xl flex flex-col z-10 animate-in slide-in-from-left duration-200 overflow-hidden">
              {renderNavContent(true)}
            </div>
          </div>
        )}

        {/* Main Content Area: auto adjusts, max 1440px centered */}
        <main className="flex-1 min-w-0 h-full overflow-y-auto custom-scrollbar p-4 md:p-6">
          <div className="max-w-[1440px] mx-auto space-y-5">
            {activeTab === 'overview' && (
              <AdminOverviewView
                users={users}
                usersLoading={usersLoading}
                usersError={usersError}
                onRetry={onRetryLoadUsers}
                pets={pets}
                schedules={schedules}
                onNavigateTab={(tab) => {
                  sound?.playClick?.();
                  setActiveTab(tab);
                }}
              />
            )}

            {activeTab === 'accounts' && (
              <AdminAccountsView
                users={users}
                usersLoading={usersLoading}
                usersError={usersError}
                onRetry={onRetryLoadUsers}
                currentAdmin={currentUser}
                onUsersUpdated={onUsersUpdated}
              />
            )}

            {activeTab === 'appointments' && (
              <VetAppointmentsAdminView
                appointments={appointments}
                users={users}
                pets={pets}
                onUpdateAppointment={onUpdateAppointment}
                onDeleteAppointment={onDeleteAppointment}
                onOpenCreateBooking={onOpenCreateBooking}
              />
            )}

            {activeTab === 'docs' && (
              <AdminAiDocsView />
            )}

            {activeTab === 'audit' && (
              <AdminAuditLogsView currentAdmin={currentUser} />
            )}

            {activeTab === 'backup' && (
              <AdminBackupView
                currentAdmin={currentUser}
                onDataChanged={onDataChanged}
              />
            )}
          </div>
        </main>

      </div>

    </div>
  );
};

export default AdminPortal;

