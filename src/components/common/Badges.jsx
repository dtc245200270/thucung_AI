import React from 'react';
import { SCHEDULE_TYPES } from '../../constants/mockData';
import { Syringe, Pill, Sparkles, Stethoscope, Activity, Utensils, Footprints, HelpCircle } from 'lucide-react';

const ICON_MAP = {
  Syringe,
  Pill,
  Sparkles,
  Stethoscope,
  Activity,
  Utensils,
  Footprints,
  HelpCircle
};

export const ScheduleBadge = ({ type, showIcon = true, className = '' }) => {
  if (!type || typeof type !== 'string' || !type.trim()) {
    return (
      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-500 border border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700 ${className}`}>
        {showIcon && <HelpCircle className="w-3.5 h-3.5 text-slate-400" />}
        Chưa phân loại
      </span>
    );
  }

  const normalizedKey = type === 'parasite' ? 'deworm' : type.trim();
  const config = SCHEDULE_TYPES[normalizedKey] || {
    label: type,
    icon: 'HelpCircle',
    bgLight: 'bg-slate-100 border-slate-200 text-slate-700 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300'
  };
  const IconComponent = ICON_MAP[config.icon] || HelpCircle;

  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${config.bgLight} ${className}`}>
      {showIcon && <IconComponent className="w-3.5 h-3.5" />}
      {config.label}
    </span>
  );
};

export const SpeciesBadge = ({ species }) => {
  const map = {
    dog: { label: 'Chó', emoji: '🐶', color: 'bg-amber-100 text-amber-800' },
    cat: { label: 'Mèo', emoji: '🐱', color: 'bg-indigo-100 text-indigo-800' },
    rabbit: { label: 'Thỏ', emoji: '🐰', color: 'bg-emerald-100 text-emerald-800' },
    hamster: { label: 'Hamster', emoji: '🐹', color: 'bg-orange-100 text-orange-800' },
    bird: { label: 'Chim', emoji: '🦜', color: 'bg-sky-100 text-sky-800' },
    other: { label: 'Thú cưng', emoji: '🐾', color: 'bg-slate-100 text-slate-800' },
  };

  const item = map[species] || map.other;

  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${item.color}`}>
      <span>{item.emoji}</span>
      <span>{item.label}</span>
    </span>
  );
};
