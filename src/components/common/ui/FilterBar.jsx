import React from 'react';
import { RotateCcw } from 'lucide-react';

/**
 * FilterBar
 * Standard container for search filters, selectors, date pickers, and view switches.
 * - Standard element heights: 40-44px
 * - Standard element radius: 10-12px (rounded-xl)
 * - Flex-wrap with deliberate spacing
 */
export const FilterBar = ({
  children,
  onReset = null,
  resetLabel = 'Đặt lại bộ lọc',
  className = ''
}) => {
  return (
    <div className={`flex flex-wrap items-center justify-between gap-3 p-3 sm:p-4 rounded-2xl bg-white dark:bg-slate-900 border border-[#E2E8F0] dark:border-white/10 shadow-sm ${className}`}>
      <div className="flex flex-wrap items-center gap-2.5 sm:gap-3 flex-1 min-w-0">
        {children}
      </div>
      
      {onReset && (
        <button
          type="button"
          onClick={onReset}
          className="h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs sm:text-sm font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shrink-0"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>{resetLabel}</span>
        </button>
      )}
    </div>
  );
};

export default FilterBar;
