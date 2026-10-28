import React from 'react';
import { sound } from '../../../services/soundService';

/**
 * Tabs
 * Unified pill/segmented tab navigation.
 * - Standard height: 40-44px
 * - Border radius: rounded-xl / capsule
 * - Selected tab: dark #202421 background with white text
 * - Accessible and responsive
 */
const renderTabBadge = (badge, isActive, isPill) => {
  if (badge === undefined || badge === null || badge === false) return null;
  if (React.isValidElement(badge)) return badge;
  let label = badge;
  if (typeof badge === 'object') {
    label = badge.label !== undefined && badge.label !== null ? badge.label : badge.text;
    if (label === undefined || label === null || label === '') return null;
  }
  const colorClass = isPill
    ? (isActive
        ? 'bg-white/20 text-white'
        : 'bg-[#EEF4F0] dark:bg-[#252E28] text-[#18201D] dark:text-[#F1F5F2]')
    : (isActive
        ? 'bg-[#202421] text-white'
        : 'bg-[#EEF4F0] dark:bg-[#252E28] text-[#64716B] dark:text-[#9AA8A0]');

  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${colorClass}`}>
      {label}
    </span>
  );
};

export const Tabs = ({
  tabs = [],
  activeTab,
  onChange,
  className = '',
  variant = 'pill' // 'pill' | 'underline' | 'segmented'
}) => {
  const handleClick = (id) => {
    try { sound?.playClick?.(); } catch {}
    onChange(id);
  };

  if (variant === 'underline') {
    return (
      <div className={`flex items-center gap-6 border-b border-[#E2E8F0] dark:border-white/10 overflow-x-auto no-scrollbar ${className}`}>
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => handleClick(tab.id)}
              className={`pb-3 text-sm font-semibold flex items-center gap-2 border-b-2 transition-all shrink-0 cursor-pointer ${
                isActive
                  ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400 dark:border-indigo-400 font-bold'
                  : 'border-transparent text-[#475569] hover:text-[#0F172A] dark:text-[#9AA8A0] dark:hover:text-[#F1F5F2]'
              }`}
            >
              {Icon && <Icon className="w-4 h-4" />}
              <span>{tab.label}</span>
              {renderTabBadge(tab.badge, isActive, false)}
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <div className={`inline-flex items-center gap-1.5 p-1 rounded-full bg-white dark:bg-slate-900 border border-[#E2E8F0] dark:border-white/10 shadow-sm overflow-x-auto max-w-full ${className}`}>
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id;
        const Icon = tab.icon;
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => handleClick(tab.id)}
            className={`min-h-[38px] px-3.5 py-1.5 rounded-full text-xs sm:text-sm font-semibold flex items-center gap-2 transition-all shrink-0 cursor-pointer ${
              isActive
                ? 'bg-indigo-600 text-white font-bold shadow-md shadow-indigo-500/25'
                : 'text-[#475569] dark:text-[#9AA8A0] hover:text-[#0F172A] dark:hover:text-[#F1F5F2] hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            {Icon && <Icon className="w-4 h-4" />}
            <span>{tab.label}</span>
            {renderTabBadge(tab.badge, isActive, true)}
          </button>
        );
      })}
    </div>
  );
};

export default Tabs;

