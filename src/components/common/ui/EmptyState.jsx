import React from 'react';
import { Sparkles } from 'lucide-react';

/**
 * EmptyState
 * Unified clean empty state presentation without screen hijacking.
 * - Neutral icon container
 * - Concise messaging
 * - Single clear action trigger (#202421 dark button)
 */
export const EmptyState = ({
  icon: Icon = Sparkles,
  title = 'Chưa có dữ liệu',
  description = 'Hiện tại chưa có mục nào được ghi nhận.',
  actionLabel = null,
  onAction = null,
  actionIcon: ActionIcon = null,
  compact = false,
  className = ''
}) => {
  return (
    <div className={`flex flex-col items-center justify-center text-center rounded-[18px] bg-white dark:bg-slate-900 border border-dashed border-[#E2E8F0] dark:border-white/10 ${
      compact ? 'py-8 px-4' : 'py-12 sm:py-14 px-6'
    } ${className}`}>
      <div className="w-12 h-12 rounded-xl bg-[#F1F5F9] dark:bg-white/10 border border-[#E2E8F0] dark:border-white/10 shadow-xs flex items-center justify-center text-[#475569] dark:text-slate-400 mb-3.5">
        <Icon className="w-6 h-6" />
      </div>

      <h3 className="text-base font-bold text-[#0F172A] dark:text-white">
        {title}
      </h3>

      {description && (
        <p className="text-xs sm:text-sm text-[#475569] dark:text-slate-400 max-w-sm mt-1">
          {description}
        </p>
      )}

      {actionLabel && onAction && (
        <button
          type="button"
          onClick={onAction}
          className="mt-4 min-h-[44px] h-11 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs sm:text-sm font-bold shadow-md shadow-indigo-500/25 flex items-center gap-2 transition-all cursor-pointer active:scale-98"
        >
          {ActionIcon && <ActionIcon className="w-4 h-4" />}
          <span>{actionLabel}</span>
        </button>
      )}
    </div>
  );
};

export default EmptyState;

