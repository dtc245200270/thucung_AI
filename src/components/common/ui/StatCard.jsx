import React from 'react';

/**
 * StatCard
 * Standard metric/statistic card for dashboards and summaries.
 * - Corner radius: 18px (rounded-[18px])
 * - Pastel backgrounds: Yellow #FFF4D6, Blue #E3F1FF, Pink #FBE6EF, Mint #E6F4EA
 * - Always bold, readable high-contrast text
 */
const BADGE_VARIANTS = {
  indigo: 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-500/20 dark:text-indigo-300 dark:border-indigo-400/30',
  emerald: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/20 dark:text-emerald-300 dark:border-emerald-400/30',
  amber: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/20 dark:text-amber-300 dark:border-amber-400/30',
  rose: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-500/20 dark:text-rose-300 dark:border-rose-400/30',
  slate: 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-white/10 dark:text-white dark:border-white/10'
};

const renderStatBadge = (badge) => {
  if (badge === null || badge === undefined || badge === false) return null;
  if (React.isValidElement(badge)) return badge;
  if (typeof badge === 'object') {
    const label = badge.label !== undefined && badge.label !== null ? badge.label : badge.text;
    if (label === undefined || label === null || label === '') return null;
    const variantClass = BADGE_VARIANTS[badge.variant] || BADGE_VARIANTS.slate;
    return (
      <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${variantClass}`}>
        {label}
      </span>
    );
  }
  return (
    <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200 dark:bg-white/10 dark:text-white dark:border-white/10">
      {badge}
    </span>
  );
};

export const StatCard = ({
  title,
  label,
  value,
  subtitle,
  subtext,
  icon: Icon,
  variant,
  color = 'indigo', // 'indigo' (blue) | 'emerald' (mint) | 'amber' (yellow) | 'rose' (pink) | 'slate' (white)
  badge = null,
  onClick = undefined,
  className = ''
}) => {
  const displayTitle = title || label;
  const displaySubtitle = subtitle || subtext;
  let activeVariant = variant || color || 'indigo';
  if (activeVariant === 'purple' || activeVariant === 'violet') activeVariant = 'indigo';

  const iconColors = {
    indigo: 'text-indigo-600 dark:text-indigo-400',
    emerald: 'text-emerald-600 dark:text-emerald-400',
    amber: 'text-amber-600 dark:text-amber-400',
    rose: 'text-rose-600 dark:text-rose-400',
    slate: 'text-slate-600 dark:text-slate-300'
  };

  const iconBgs = {
    indigo: 'bg-indigo-50 border-indigo-100 text-indigo-600 dark:bg-white/10 dark:border-white/10 dark:text-indigo-400',
    emerald: 'bg-emerald-50 border-emerald-100 text-emerald-600 dark:bg-white/10 dark:border-white/10 dark:text-emerald-400',
    amber: 'bg-amber-50 border-amber-100 text-amber-600 dark:bg-white/10 dark:border-white/10 dark:text-amber-400',
    rose: 'bg-rose-50 border-rose-100 text-rose-600 dark:bg-white/10 dark:border-white/10 dark:text-rose-400',
    slate: 'bg-slate-100 border-slate-200 text-slate-600 dark:bg-white/10 dark:border-white/10 dark:text-slate-300'
  };

  const iconColor = iconColors[activeVariant] || iconColors.indigo;
  const iconBg = iconBgs[activeVariant] || iconBgs.indigo;

  return (
    <div
      onClick={onClick}
      className={`bg-white dark:bg-slate-900/80 border border-[#E2E8F0] dark:border-white/10 rounded-3xl shadow-sm dark:shadow-xl p-4 sm:p-5 flex flex-col justify-between transition-all ${
        onClick ? 'cursor-pointer hover:border-indigo-300 dark:hover:border-white/25 hover:shadow-md hover:scale-[1.01]' : ''
      } ${className}`}
    >
      <div className="flex items-center justify-between gap-3 mb-2">
        <span className="text-xs sm:text-sm font-bold truncate text-[#475569] dark:text-slate-400">
          {displayTitle}
        </span>
        {Icon && (
          <div className={`w-10 h-10 rounded-2xl ${iconBg} border flex items-center justify-center shrink-0 shadow-xs`}>
            <Icon className={`w-5 h-5 ${iconColor}`} />
          </div>
        )}
      </div>

      <div className="mt-1">
        <div className="flex items-baseline gap-2">
          <span className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[#0F172A] dark:text-white">
            {value}
          </span>
          {renderStatBadge(badge)}
        </div>
        {displaySubtitle && (
          <p className="text-xs font-semibold text-[#475569] dark:text-slate-400 mt-1 truncate">
            {displaySubtitle}
          </p>
        )}
      </div>
    </div>
  );
};

export default StatCard;

