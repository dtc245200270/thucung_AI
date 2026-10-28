import React from 'react';

const BADGE_VARIANTS = {
  indigo: 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border-indigo-200/60 dark:border-indigo-800/60',
  emerald: 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200/60 dark:border-emerald-800/60',
  amber: 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border-amber-200/60 dark:border-amber-800/60',
  rose: 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border-rose-200/60 dark:border-rose-800/60',
  slate: 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700',
  purple: 'bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border-purple-200/60 dark:border-purple-800/60',
  blue: 'bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border-blue-200/60 dark:border-blue-800/60'
};

const renderBadge = (badge) => {
  if (badge === null || badge === undefined || badge === false) {
    return null;
  }

  // Nếu badge là một React element hợp lệ
  if (React.isValidElement(badge)) {
    return badge;
  }

  // Nếu badge là object có cấu trúc { label, variant }
  if (typeof badge === 'object') {
    const label = badge.label !== undefined && badge.label !== null ? badge.label : badge.text;
    if (label === undefined || label === null || label === '') {
      return null;
    }
    const variantKey = badge.variant && BADGE_VARIANTS[badge.variant] ? badge.variant : 'indigo';
    const variantClass = BADGE_VARIANTS[variantKey];

    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${variantClass}`}>
        {label}
      </span>
    );
  }

  // Nếu badge là chuỗi hoặc số nguyên thủy
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${BADGE_VARIANTS.indigo}`}>
      {badge}
    </span>
  );
};

/**
 * PageHeader
 * Unified header for all portal pages.
 * - Title size: 26-28px (text-2xl sm:text-[28px])
 * - Subtitle: 14px (text-sm text-slate-500 dark:text-slate-400)
 * - Actions row: 40-44px buttons, aligned flush right
 */
export const PageHeader = ({
  title,
  subtitle,
  badge = null,
  actions = null,
  className = ''
}) => {
  return (
    <div className={`flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-1 border-b border-[#E2E8F0] dark:border-white/10 ${className}`}>
      <div className="min-w-0">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl sm:text-[28px] font-bold text-[#0F172A] dark:text-white tracking-tight leading-tight">
            {title}
          </h1>
          {renderBadge(badge)}
        </div>
        {subtitle && (
          <p className="text-sm text-[#475569] dark:text-slate-400 mt-1 line-clamp-2">
            {subtitle}
          </p>
        )}
      </div>

      {actions && (
        <div className="flex items-center gap-2.5 flex-wrap shrink-0">
          {actions}
        </div>
      )}
    </div>
  );
};

export default PageHeader;
