import React, { useState, useEffect } from 'react';
import { 
  LayoutDashboard, 
  CalendarDays, 
  PawPrint, 
  Stethoscope, 
  Clock, 
  PanelLeftClose, 
  PanelLeftOpen, 
  LogOut, 
  User, 
  X, 
  ShieldCheck, 
  ChevronUp 
} from 'lucide-react';
import { sound } from '../../services/soundService';

export const VetSidebar = ({ 
  activeTab = 'dashboard', 
  setActiveTab = () => {}, 
  isCollapsed = false,
  onToggleCollapse = () => {},
  isMobileOpen = false, 
  setIsMobileOpen = () => {},
  pendingCount = 0,
  patientsCount = 0,
  currentUser = null,
  onOpenProfileModal = () => {},
  onLogout = null
}) => {
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);

  // 5 danh mục chuẩn theo yêu cầu:
  // 1. Tổng quan
  // 2. Lịch khám
  // 3. Hồ sơ bệnh nhân
  // 4. Bệnh án & Đơn thuốc
  // 5. Lịch làm việc
  const vetNavItems = [
    {
      id: 'dashboard',
      label: 'Tổng quan',
      icon: LayoutDashboard
    },
    {
      id: 'appointments',
      label: 'Lịch khám',
      icon: CalendarDays,
      badge: pendingCount > 0 ? pendingCount : null
    },
    {
      id: 'patients',
      label: 'Hồ sơ bệnh nhân',
      icon: PawPrint,
      badge: patientsCount > 0 ? patientsCount : null
    },
    {
      id: 'soap',
      label: 'Bệnh án & Đơn thuốc',
      icon: Stethoscope
    },
    {
      id: 'schedule',
      label: 'Lịch làm việc',
      icon: Clock
    }
  ];

  // Đóng drawer / popover khi bấm Escape
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        if (isUserMenuOpen) setIsUserMenuOpen(false);
        if (isMobileOpen) setIsMobileOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isUserMenuOpen, isMobileOpen, setIsMobileOpen]);

  const handleNavClick = (id) => {
    try { sound?.playClick?.(); } catch {}
    setActiveTab(id);
    if (isMobileOpen) {
      setIsMobileOpen(false);
    }
  };

  const handleLogoutAction = () => {
    try { sound?.playClick?.(); } catch {}
    setIsUserMenuOpen(false);
    if (onLogout) {
      onLogout();
    } else {
      localStorage.removeItem('petcare_active_user');
      localStorage.removeItem('petcare_current_user');
      localStorage.removeItem('petcare_is_authenticated');
      localStorage.removeItem('petcare_current_portal');
      localStorage.removeItem('petcare_token');
      localStorage.removeItem('petcare_auth_token');
      window.location.reload();
    }
  };

  const renderNavContent = (isMobile = false) => {
    const collapsed = !isMobile && isCollapsed;

    return (
      <div className="flex flex-col h-full justify-between select-none bg-[#202421] text-white rounded-[28px] overflow-hidden">
        {/* TOP: Header & Collapse/Close */}
        <div className="shrink-0 p-2 border-b border-[#2D332F]">
          <div className={`h-11 flex items-center ${
            collapsed ? 'justify-center' : 'justify-between px-2'
          }`}>
            {!collapsed && (
              <div 
                onClick={() => handleNavClick('dashboard')}
                className="flex items-center gap-2 cursor-pointer min-w-0"
                title="PetCare Bác sĩ - Về trang Tổng quan"
              >
                <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-500/30 shrink-0">
                  <Stethoscope className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <span className="font-extrabold text-sm text-white tracking-tight block leading-tight">
                    PetCare Clinic
                  </span>
                  <span className="text-[10px] font-semibold text-emerald-400 block leading-tight">
                    Bác sĩ Thú y
                  </span>
                </div>
              </div>
            )}

            {/* Collapse toggle (Desktop/Tablet) or Close drawer (Mobile) */}
            {isMobile ? (
              <button
                type="button"
                onClick={() => setIsMobileOpen(false)}
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
                  onToggleCollapse();
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

        {/* MIDDLE: Top-aligned Navigation Items List */}
        <nav 
          className="p-2 space-y-1.5 flex-1 overflow-y-auto custom-scrollbar"
          aria-label="Danh mục chức năng Bác sĩ"
        >
          {vetNavItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;

            return (
              <div key={item.id} className="relative group">
                <button
                  type="button"
                  onClick={() => handleNavClick(item.id)}
                  className={`w-full min-h-[44px] h-11 flex items-center rounded-2xl text-[14px] font-semibold transition-all relative cursor-pointer focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-emerald-400 ${
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
                      className={`absolute rounded-full bg-emerald-400 transition-all ${
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
                        : 'bg-emerald-500/80 text-white'
                    }`}>
                      {item.badge}
                    </span>
                  )}

                  {/* Dot badge on collapsed mode */}
                  {collapsed && item.badge && (
                    <span 
                      className="absolute top-2.5 right-2.5 w-2 h-2 rounded-full bg-emerald-400 ring-2 ring-[#202421]" 
                      aria-hidden="true"
                    />
                  )}
                </button>

                {/* Accessible Floating Tooltip on Hover & Focus when Collapsed */}
                {collapsed && (
                  <div 
                    role="tooltip"
                    className="absolute left-full ml-3 top-1/2 -translate-y-1/2 px-2.5 py-1.5 rounded-xl bg-[#202421] text-white text-xs font-semibold whitespace-nowrap shadow-xl opacity-0 pointer-events-none group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity duration-150 z-50 border border-[#2D332F] flex items-center gap-2"
                  >
                    <span>{item.label}</span>
                    {item.badge && (
                      <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold font-mono bg-emerald-500 text-white">
                        {item.badge}
                      </span>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        {/* BOTTOM: Logged-in Doctor Account & Menu */}
        <div className="p-2 border-t border-[#2D332F] shrink-0 relative">
          <div className="relative">
            <button
              type="button"
              onClick={() => setIsUserMenuOpen(prev => !prev)}
              className={`w-full min-h-[44px] h-11 flex items-center rounded-2xl hover:bg-[#2A302B] transition-colors cursor-pointer group text-left focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-emerald-400 ${
                collapsed 
                  ? 'justify-center p-0' 
                  : 'justify-start px-2 gap-2.5'
              }`}
              aria-label="Menu tài khoản bác sĩ"
              aria-expanded={isUserMenuOpen}
            >
              {/* Avatar */}
              <div className="w-8 h-8 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold text-xs ring-2 ring-emerald-500/40 overflow-hidden shrink-0">
                {currentUser?.avatar ? (
                  <img 
                    src={currentUser.avatar} 
                    alt={currentUser.name} 
                    className="w-full h-full object-cover" 
                  />
                ) : (
                  <span>{currentUser?.name?.slice(0, 1) || 'B'}</span>
                )}
              </div>

              {/* Name & Specialty when expanded */}
              {!collapsed && (
                <div className="min-w-0 flex-1">
                  <div className="text-[13px] font-bold text-white truncate">
                    {currentUser?.name || 'Bác sĩ Thú y'}
                  </div>
                  <div className="text-[11px] text-emerald-400 truncate">
                    {currentUser?.specialty || 'Chuyên khoa Thú y'}
                  </div>
                </div>
              )}

              {!collapsed && (
                <ChevronUp className={`w-4 h-4 text-[#9AA8A0] transition-transform ${isUserMenuOpen ? '' : 'rotate-180'}`} />
              )}
            </button>

            {/* User Popover Menu */}
            {isUserMenuOpen && (
              <div className="absolute bottom-full mb-2 left-0 w-56 rounded-2xl bg-[#202421] border border-[#2D332F] shadow-2xl p-1.5 z-50 animate-in fade-in slide-in-from-bottom-2">
                <div className="px-3 py-2 border-b border-[#2D332F]">
                  <div className="text-xs font-bold text-white truncate">
                    {currentUser?.name}
                  </div>
                  <div className="text-[11px] text-[#9AA8A0] truncate">
                    {currentUser?.email}
                  </div>
                </div>

                <div className="p-1 space-y-1">
                  <button
                    type="button"
                    onClick={() => {
                      setIsUserMenuOpen(false);
                      onOpenProfileModal();
                    }}
                    className="w-full flex items-center gap-2 px-2.5 py-2 text-xs font-semibold text-[#F1F5F2] hover:bg-[#2A302B] rounded-xl cursor-pointer"
                  >
                    <User className="w-4 h-4 text-[#9AA8A0]" />
                    <span>Hồ sơ bác sĩ</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleLogoutAction}
                    className="w-full flex items-center gap-2 px-2.5 py-2 text-xs text-rose-400 hover:bg-rose-500/10 rounded-xl cursor-pointer font-semibold"
                  >
                    <LogOut className="w-4 h-4 text-rose-400" />
                    <span>Đăng xuất</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <>
      {/* 1. DESKTOP/TABLET FLOATING SIDEBAR CONTAINER: 224px expanded, 64px collapsed, rounded-28px, 16px from left */}
      <aside 
        className={`hidden md:flex flex-col shrink-0 my-2 ml-4 mb-4 rounded-[28px] shadow-lg border border-[#2D332F] z-30 transition-all duration-200 ease-in-out select-none ${
          isCollapsed ? 'w-[64px]' : 'w-[224px]'
        }`}
        style={{ height: 'calc(100vh - 80px)' }}
        aria-label="Thanh điều hướng Bác sĩ"
      >
        {renderNavContent(false)}
      </aside>

      {/* 2. MOBILE DRAWER OVERLAY */}
      {isMobileOpen && (
        <div 
          className="fixed inset-0 z-50 md:hidden flex"
          role="dialog"
          aria-modal="true"
        >
          {/* Backdrop */}
          <div 
            className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity animate-in fade-in duration-200"
            onClick={() => setIsMobileOpen(false)}
          />
          {/* Drawer content */}
          <div className="relative w-72 max-w-[85vw] h-full bg-[#202421] text-white rounded-r-[28px] border-r border-[#2D332F] shadow-2xl flex flex-col z-10 animate-in slide-in-from-left duration-200 overflow-hidden">
            {renderNavContent(true)}
          </div>
        </div>
      )}
    </>
  );
};

export default VetSidebar;

