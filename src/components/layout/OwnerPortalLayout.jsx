import React, { useState } from 'react';
import { Navbar } from './Navbar';
import { Sidebar } from './Sidebar';

/**
 * OwnerPortalLayout
 * Master Layout Container for Pet Care Owner Portal
 * Features:
 * - Left Sidebar (w-56 / 224px desktop, w-[72px] collapsed/tablet, drawer mobile)
 * - Top Header (Navbar with dynamic page title, search trigger, theme toggle, notifications)
 * - Single Main Scroll Area (No nested viewport scrollbars, no margin hacks)
 */
export const OwnerPortalLayout = ({
  children,
  activeTab = 'dashboard',
  setActiveTab = () => {},
  pets = [],
  schedules = [],
  onOpenGlobalSearch = () => {},
  isMobileMenuOpen = false,
  setIsMobileMenuOpen = () => {},
  theme = 'dark',
  onToggleTheme = () => {},
  onToggleComplete = () => {},
  currentUser = null,
  onOpenProfileModal = () => {},
  onLogout = () => {},
  onSwitchPortal = () => {},
  overdueCount = 0,
  todayCount = 0,
  pendingAppointmentsCount = 0
}) => {
  const [isCollapsed, setIsCollapsed] = useState(() => {
    if (typeof window !== 'undefined') {
      if (window.innerWidth >= 768 && window.innerWidth < 1024) {
        return true;
      }
      return localStorage.getItem('petcare_sidebar_collapsed') === 'true';
    }
    return false;
  });

  const handleToggleCollapse = () => {
    setIsCollapsed(prev => {
      const next = !prev;
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('petcare_sidebar_collapsed', String(next));
      }
      return next;
    });
  };

  return (
    <div className="h-screen w-full flex flex-col overflow-hidden antialiased bg-transparent text-slate-800 dark:text-white">
      {/* 1. Top Header: 64px, Logo on left, Centered Pill Menu, Capsule utilities on right */}
      <Navbar
        pets={pets}
        schedules={schedules}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        theme={theme}
        onToggleTheme={onToggleTheme}
        onToggleComplete={onToggleComplete}
        onOpenGlobalSearch={onOpenGlobalSearch}
        onToggleMobileMenu={() => setIsMobileMenuOpen(prev => !prev)}
      />

      {/* 2. Body Area: Centered Main View */}
      <div className="flex-1 min-w-0 flex overflow-hidden">
        <Sidebar
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          isCollapsed={isCollapsed}
          onToggleCollapse={handleToggleCollapse}
          isMobileOpen={isMobileMenuOpen}
          setIsMobileOpen={setIsMobileMenuOpen}
          overdueCount={overdueCount}
          todayCount={todayCount}
          pendingAppointmentsCount={pendingAppointmentsCount}
          currentUser={currentUser}
          onOpenProfileModal={onOpenProfileModal}
          onLogout={onLogout}
          onSwitchPortal={onSwitchPortal}
        />

        {/* Scrollable View Area: Centered max-w-7xl tràn đều toàn màn hình, pt-[100px] tránh bị navbar che */}
        <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-[100px] pb-6 h-full overflow-y-auto overflow-x-hidden custom-scrollbar">
          {children}
        </main>
      </div>
    </div>
  );
};

export default OwnerPortalLayout;
