import React from 'react';
import { useTheme } from '../../context/ThemeContext';

/**
 * AuraBackground
 * Clean, modern dashboard background container
 * - Light Mode: Gentle pale mint to light gray (#EEF4F0)
 * - Dark Mode: Deep forest slate (#121714)
 * - Clean subtle background without neon, heavy blur, or intense glows
 */
export const AuraBackground = ({ children, className = '' }) => {
  const themeContext = useTheme();
  const isDark = themeContext?.isDark ?? false;

  return (
    <div 
      className={`relative min-h-screen w-full overflow-hidden transition-colors duration-500 bg-gradient-to-br from-[#DDF2F5] via-[#F1F5F9] to-[#EEEAF6] dark:from-[#020617] dark:via-[#0b0f19] dark:to-[#1e1b4b] text-[#1E293B] dark:text-slate-100 ${className}`}
    >
      {/* Dynamic Ambient Mesh Glow Orbs (Subtle in light, cosmic in dark) */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0" aria-hidden="true">
        {/* Light mode soft pastel glow orbs / Dark mode vivid glow orbs */}
        <div className="absolute -top-48 -left-48 w-[650px] h-[650px] bg-teal-300/20 dark:bg-indigo-600/25 rounded-full blur-[130px] animate-pulse" />
        <div className="absolute top-1/4 -right-48 w-[650px] h-[650px] bg-purple-300/20 dark:bg-purple-600/20 rounded-full blur-[140px]" />
        <div className="absolute -bottom-48 left-1/4 w-[750px] h-[750px] bg-sky-300/20 dark:bg-blue-600/20 rounded-full blur-[150px]" />
        <div className="absolute top-2/3 right-1/4 w-[500px] h-[500px] bg-indigo-200/25 dark:bg-teal-500/15 rounded-full blur-[130px]" />
        
        {/* Dark Mode Ambient Shading ONLY - NEVER in light mode, and without blur that harms text */}
        <div className="hidden dark:block absolute inset-0 bg-slate-950/20 pointer-events-none" />
      </div>

      {/* Content wrapper */}
      <div className="relative z-10 w-full min-h-screen flex flex-col">
        {children}
      </div>
    </div>
  );
};

export default AuraBackground;

