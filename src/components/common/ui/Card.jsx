import React from 'react';

/**
 * Card
 * Unified surface card for dashboard, details, lists, and forms.
 * - Corner radius: 18px (rounded-[18px])
 * - Border: #E5E7EB (dark: #344039)
 * - Background: #FFFFFF (dark: #1D2520)
 * - Shadow: subtle clean elevation (no heavy neon or glow)
 * - Text primary: #18201D (dark: #F1F5F2), secondary: #64716B (dark: #9AA8A0)
 */
export const Card = ({
  children,
  className = '',
  padding = 'p-5 sm:p-6',
  hover = false,
  onClick = undefined,
  id = undefined,
  ...props
}) => {
  return (
    <div
      id={id}
      onClick={onClick}
      {...props}
      className={`bg-white dark:bg-slate-900/80 border border-[#E2E8F0] dark:border-white/10 rounded-3xl shadow-sm dark:shadow-xl text-[#1E293B] dark:text-slate-100 transition-all ${
        hover ? 'hover:border-indigo-300 dark:hover:border-white/25 hover:shadow-md hover:scale-[1.005] cursor-pointer' : ''
      } ${padding} ${className}`}
    >
      {children}
    </div>
  );
};

export const CardHeader = ({ 
  title, 
  subtitle, 
  icon: Icon, 
  action, 
  className = '' 
}) => {
  return (
    <div className={`flex items-start justify-between gap-3 pb-4 border-b border-[#E2E8F0] dark:border-white/10 mb-4 ${className}`}>
      <div className="flex items-center gap-2.5 min-w-0">
        {Icon && (
          <div className="w-9 h-9 rounded-2xl bg-[#F1F5F9] dark:bg-white/10 border border-[#E2E8F0] dark:border-white/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0 shadow-xs">
            <Icon className="w-5 h-5" />
          </div>
        )}
        <div className="min-w-0">
          <h2 className="text-base sm:text-lg font-bold text-[#0F172A] dark:text-white truncate">
            {title}
          </h2>
          {subtitle && (
            <p className="text-xs text-[#475569] dark:text-slate-400 truncate mt-0.5">
              {subtitle}
            </p>
          )}
        </div>
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
};

export default Card;

