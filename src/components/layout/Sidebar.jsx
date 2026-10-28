import React, { useState, useEffect } from 'react';
import { 
  LayoutDashboard, 
  PawPrint, 
  CalendarDays, 
  Stethoscope, 
  DollarSign, 
  Activity,
  Scan, 
  HeartHandshake,
  PanelLeftClose,
  PanelLeftOpen,
  User, 
  LogOut, 
  Building2,
  ShieldAlert,
  ChevronUp,
  X
} from 'lucide-react';
import { sound } from '../../services/soundService';

export const Sidebar = ({ 
  activeTab, 
  setActiveTab, 
  isCollapsed = false,
  onToggleCollapse = () => {},
  isMobileOpen = false, 
  setIsMobileOpen = () => {},
  overdueCount = 0,
  todayCount = 0,
  pendingAppointmentsCount = 0,
  currentUser = null,
  onOpenProfileModal = () => {},
  onLogout = null,
  onSwitchPortal = () => {}
}) => {
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);

  // Exactly the 7 standardized Owner portal categories:
  const ownerNavItems = [
    {
      id: 'dashboard',
      label: 'Tổng quan',
      icon: LayoutDashboard,
      badge: todayCount > 0 ? todayCount : null
    },
    {
      id: 'pets',
      label: 'Thú cưng',
      icon: PawPrint
    },
    {
      id: 'schedule',
      label: 'Lịch trình',
      icon: CalendarDays,
      badge: overdueCount > 0 ? overdueCount : null
    },
    {
      id: 'bonding',
      label: 'Hoạt động & Nhật ký',
      icon: Activity
    },
    {
      id: 'medical',
      label: 'Hồ sơ sức khỏe',
      icon: Stethoscope,
      badge: pendingAppointmentsCount > 0 ? pendingAppointmentsCount : null
    },
    {
      id: 'expenses',
      label: 'Chi tiêu',
      icon: DollarSign
    },
    {
      id: 'ai-vision',
      label: 'AI quan sát ảnh',
      icon: Scan
    }
  ];

  // Role-based portal switches at bottom of nav (if authorized)
  const roleNavItems = [
    ...((currentUser?.role === 'CLINIC_ADMIN' || (currentUser?.role === 'vet_doctor' && currentUser?.vetStatus === 'approved')) ? [{
      id: 'clinic-os',
      label: 'Bệnh viện Thú y',
      icon: Building2,
      badge: 'PRO'
    }] : []),
    ...(currentUser?.role === 'system_admin' ? [{
      id: 'admin-portal-switch',
      label: 'Cổng Quản Trị',
      icon: ShieldAlert,
      badge: 'ADMIN'
    }] : [])
  ];

  // Handle closing drawer / popover on Escape key
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

  return (
    <>
      {/* 1. KHUNG NGOÀI CÙNG: VIÊN NANG DỌC (VERTICAL FLOATING PILL) */}
      <aside 
        className="fixed left-4 top-1/2 -translate-y-1/2 flex flex-col items-center gap-2 py-4 px-2 bg-white/95 dark:bg-slate-900/90 backdrop-blur-md rounded-[2rem] shadow-sm border border-[#E2E8F0] dark:border-white/10 z-50"
        aria-label="Thanh điều hướng dọc dạng viên nang nổi"
      >
        {/* Brand Top Icon */}
        <div className="shrink-0 mb-1">
          <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-xs">
            <HeartHandshake className="w-5 h-5" />
          </div>
        </div>

        {/* 2. CÁC NÚT MENU (7 MENU ICONS CHÍNH) */}
        <nav className="flex flex-col items-center gap-2" aria-label="Danh mục chức năng Chủ nuôi">
          {ownerNavItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;

            return (
              <div key={item.id} className="relative group">
                <button
                  type="button"
                  onClick={() => handleNavClick(item.id)}
                  className={`cursor-pointer transition-all duration-300 relative focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-indigo-400 ${
                    isActive
                      ? 'w-12 h-12 flex items-center justify-center bg-indigo-600 text-white rounded-[1.2rem] shadow-md shadow-indigo-500/25'
                      : 'w-12 h-12 flex items-center justify-center text-[#475569] hover:bg-slate-100 hover:text-[#0F172A] dark:text-slate-400 dark:hover:bg-white/10 dark:hover:text-white rounded-[1.2rem]'
                  }`}
                  aria-label={item.label}
                  aria-current={isActive ? 'page' : undefined}
                >
                  <Icon className="w-5 h-5 shrink-0 transition-transform duration-200 group-hover:scale-110" />
                  
                  {/* 3. Ẩn Text khi ở chế độ Glass Pill */}
                  <span className="hidden">{item.label}</span>

                  {/* Dot Notification Badge */}
                  {item.badge && (
                    <span 
                      className="absolute top-2.5 right-2.5 w-2.5 h-2.5 rounded-full bg-rose-500 ring-2 ring-white dark:ring-slate-900" 
                      aria-hidden="true" 
                    />
                  )}
                </button>

                {/* Spatial Glass Floating Tooltip on Hover */}
                <div 
                  role="tooltip"
                  className="absolute left-full ml-3.5 top-1/2 -translate-y-1/2 px-3 py-1.5 rounded-xl bg-white dark:bg-slate-900 text-[#0F172A] dark:text-white text-xs font-semibold whitespace-nowrap shadow-xl opacity-0 pointer-events-none group-hover:opacity-100 group-focus-within:opacity-100 transition-all duration-150 z-50 border border-[#E2E8F0] dark:border-white/10 flex items-center gap-2"
                >
                  <span>{item.label}</span>
                  {item.badge && (
                    <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold font-mono bg-rose-500 text-white">
                      {typeof item.badge === 'object' ? (item.badge.label ?? item.badge.text) : item.badge}
                    </span>
                  )}
                </div>
              </div>
            );
          })}

          {/* Role Portal Switches (Clinic OS / Admin) */}
          {roleNavItems.length > 0 && (
            <div className="pt-2 border-t border-[#E2E8F0] dark:border-white/10 flex flex-col items-center gap-2 w-full">
              {roleNavItems.map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;
                return (
                  <div key={item.id} className="relative group">
                    <button
                      type="button"
                      onClick={() => handleNavClick(item.id)}
                      className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all duration-300 relative cursor-pointer focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-amber-400 ${
                        isActive
                          ? 'bg-amber-100 text-amber-700 dark:bg-amber-500/30 dark:text-amber-400 border border-amber-300 dark:border-amber-400/40 shadow-xs'
                          : 'text-[#475569] dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/10 hover:text-[#0F172A] dark:hover:text-white'
                      }`}
                      aria-label={item.label}
                    >
                      <Icon className="w-5 h-5 shrink-0 text-amber-500" />
                      <span className="hidden">{item.label}</span>
                    </button>
                    <div 
                      role="tooltip"
                      className="absolute left-full ml-3.5 top-1/2 -translate-y-1/2 px-3 py-1.5 rounded-xl bg-white dark:bg-slate-900 text-[#0F172A] dark:text-white text-xs font-semibold whitespace-nowrap shadow-xl opacity-0 pointer-events-none group-hover:opacity-100 group-focus-within:opacity-100 transition-all duration-150 z-50 border border-[#E2E8F0] dark:border-white/10"
                    >
                      <span>{item.label}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </nav>

        {/* BOTTOM: User Avatar Pill Button & Popover */}
        <div className="shrink-0 mt-1 relative">
          <button
            type="button"
            onClick={() => setIsUserMenuOpen(prev => !prev)}
            className="w-12 h-12 rounded-2xl flex items-center justify-center hover:bg-slate-100 dark:hover:bg-white/10 transition-all cursor-pointer relative group focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-emerald-400"
            aria-label="Tài khoản cá nhân"
            aria-expanded={isUserMenuOpen}
          >
            <div className="w-9 h-9 rounded-xl overflow-hidden bg-slate-100 dark:bg-black/30 border border-[#E2E8F0] dark:border-white/20 shrink-0 relative shadow-xs">
              {currentUser?.avatar ? (
                <img 
                  src={currentUser.avatar} 
                  alt={currentUser.name || 'User'} 
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-[#475569] dark:text-slate-400">
                  <User className="w-5 h-5" />
                </div>
              )}
              <span className="absolute bottom-0 right-0 w-2 h-2 rounded-full bg-emerald-500 ring-1 ring-white dark:ring-black" />
            </div>
          </button>

          {/* User tooltip on hover */}
          <div 
            role="tooltip"
            className="absolute left-full ml-3.5 top-1/2 -translate-y-1/2 px-3 py-1.5 rounded-xl bg-white dark:bg-slate-900 text-[#0F172A] dark:text-white text-xs font-semibold whitespace-nowrap shadow-xl opacity-0 pointer-events-none group-hover:opacity-100 group-focus-within:opacity-100 transition-all duration-150 z-50 border border-[#E2E8F0] dark:border-white/10"
          >
            <span>{currentUser?.name || 'Chủ nuôi'}</span>
          </div>

          {/* User Popover Menu */}
          {isUserMenuOpen && (
            <>
              <div 
                className="fixed inset-0 z-40" 
                onClick={() => setIsUserMenuOpen(false)} 
              />
              <div className="absolute left-full ml-3 bottom-0 mb-0 z-50 w-64 rounded-2xl bg-white dark:bg-slate-900 border border-[#E2E8F0] dark:border-white/10 shadow-2xl p-2 animate-in fade-in zoom-in-95 duration-150 text-left text-[#1E293B] dark:text-white">
                <div className="px-3 py-2 border-b border-[#E2E8F0] dark:border-white/10">
                  <p className="text-sm font-bold text-[#0F172A] dark:text-white truncate">
                    {currentUser?.name || "Chủ nuôi"}
                  </p>
                  <p className="text-xs text-[#475569] dark:text-slate-400 truncate mt-0.5">
                    {currentUser?.email || "petowner@petcare.ai"}
                  </p>
                  <span className="inline-block mt-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 dark:bg-white/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20">
                    {currentUser?.role === 'system_admin'
                      ? 'Quản trị hệ thống'
                      : (currentUser?.role === 'vet_doctor' || currentUser?.role === 'CLINIC_ADMIN')
                      ? 'Bác sĩ thú y'
                      : 'Chủ nuôi'}
                  </span>
                </div>

                <div className="py-1">
                  <button
                    type="button"
                    onClick={() => {
                      setIsUserMenuOpen(false);
                      onOpenProfileModal('profile');
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-[#1E293B] dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/10 rounded-xl transition-colors cursor-pointer"
                  >
                    <User className="w-4 h-4 text-[#475569] dark:text-slate-400" />
                    <span>Hồ sơ cá nhân & Cài đặt</span>
                  </button>

                  {(currentUser?.role === 'CLINIC_ADMIN' || (currentUser?.role === 'vet_doctor' && currentUser?.vetStatus === 'approved')) && (
                    <button
                      type="button"
                      onClick={() => {
                        setIsUserMenuOpen(false);
                        onSwitchPortal('CLINIC');
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 rounded-xl transition-colors cursor-pointer"
                    >
                      <Building2 className="w-4 h-4 text-emerald-500" />
                      <span>Chuyển sang Clinic OS</span>
                    </button>
                  )}
                </div>

                <div className="pt-1 border-t border-[#E2E8F0] dark:border-white/10">
                  <button
                    type="button"
                    onClick={handleLogoutAction}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-xl transition-colors cursor-pointer"
                  >
                    <LogOut className="w-4 h-4 text-rose-500" />
                    <span>Đăng xuất</span>
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </aside>

      {/* MOBILE DRAWER (Off-canvas) */}
      {isMobileOpen && (
        <div 
          className="fixed inset-0 z-50 lg:hidden flex"
          role="dialog"
          aria-modal="true"
        >
          {/* Backdrop */}
          <div 
            className="fixed inset-0 bg-slate-950/40 backdrop-blur-sm transition-opacity animate-in fade-in duration-200"
            onClick={() => setIsMobileOpen(false)}
          />
          {/* Drawer content */}
          <div className="relative w-72 max-w-[85vw] h-full bg-white dark:bg-slate-900 text-[#1E293B] dark:text-white rounded-r-[2.5rem] border-r border-[#E2E8F0] dark:border-white/10 shadow-2xl flex flex-col z-10 animate-in slide-in-from-left duration-200 overflow-hidden p-4 justify-between">
            <div className="space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-[#E2E8F0] dark:border-white/10">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-xs">
                    <HeartHandshake className="w-5 h-5" />
                  </div>
                  <span className="font-extrabold text-base tracking-tight text-[#0F172A] dark:text-white">PetCare</span>
                </div>
                <button
                  type="button"
                  onClick={() => setIsMobileOpen(false)}
                  className="w-9 h-9 rounded-xl flex items-center justify-center text-[#475569] hover:text-[#0F172A] dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/10 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <nav className="space-y-1.5" aria-label="Menu di động">
                {ownerNavItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = activeTab === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => handleNavClick(item.id)}
                      className={`w-full h-11 px-3 rounded-2xl flex items-center gap-3 text-sm font-semibold transition-all ${
                        isActive
                          ? 'bg-indigo-600 text-white font-bold shadow-md shadow-indigo-500/25'
                          : 'text-[#475569] dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/10 hover:text-[#0F172A] dark:hover:text-white'
                      }`}
                    >
                      <Icon className="w-5 h-5 shrink-0" />
                      <span>{item.label}</span>
                      {item.badge && (
                        <span className="ml-auto px-2 py-0.5 rounded-full text-xs font-bold font-mono bg-rose-500 text-white">
                          {typeof item.badge === 'object' ? (item.badge.label ?? item.badge.text) : item.badge}
                        </span>
                      )}
                    </button>
                  );
                })}
              </nav>
            </div>

            <div className="pt-3 border-t border-[#E2E8F0] dark:border-white/10">
              <button
                type="button"
                onClick={handleLogoutAction}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-xl transition-colors"
              >
                <LogOut className="w-4 h-4 text-rose-500" />
                <span>Đăng xuất</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default Sidebar;

