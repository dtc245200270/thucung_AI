import React from 'react';
import { Sun, Moon } from 'lucide-react';
import { sound } from '../../services/soundService';
import { useTheme } from '../../context/ThemeContext';

/**
 * Animated Day/Night Toggle (Pill Sky Switch)
 * Compact pill-shaped switch featuring animated sky backgrounds, sliding celestial orb (Sun/Moon),
 * twinkling stars, and layered drifting clouds.
 */
export function DayNightSwitch({ isDark: propIsDark, onToggle: propOnToggle, className = '' }) {
  const contextTheme = useTheme();

  const isDark = propIsDark !== undefined ? propIsDark : (contextTheme?.isDark ?? true);
  const handleToggle = propOnToggle || contextTheme?.toggleTheme;

  const handleClick = (e) => {
    e.stopPropagation();
    try {
      sound.playClick();
    } catch {
      // ignore
    }
    if (handleToggle) handleToggle();
  };

  return (
    <button
      type="button"
      role="switch"
      aria-checked={isDark}
      onClick={handleClick}
      title={isDark ? 'Chuyển sang giao diện ban ngày (Day Mode)' : 'Chuyển sang giao diện ban đêm (Night Mode)'}
      className={`relative inline-flex items-center w-[60px] h-[30px] rounded-full p-[3px] cursor-pointer select-none overflow-hidden transition-all duration-500 border border-white/20 shadow-inner group focus:outline-hidden focus:ring-2 focus:ring-purple-400/50 ${className}`}
    >
      {/* ============================================================ */}
      {/* 1. BACKGROUND SKY LAYERS (Smooth Cross-fade)                 */}
      {/* ============================================================ */}
      
      {/* DAY SKY (Bright azure to cyan gradient) */}
      <div 
        className={`absolute inset-0 bg-gradient-to-r from-sky-400 via-sky-300 to-blue-500 transition-opacity duration-500 ${
          isDark ? 'opacity-0 pointer-events-none' : 'opacity-100'
        }`}
      >
        {/* Soft Golden Sun Light Glow on Right */}
        <div className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-amber-200/50 blur-xs" />
        <div className="absolute right-3.5 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-amber-100/80" />
      </div>

      {/* NIGHT SKY (Deep cosmic midnight blue-purple gradient) */}
      <div 
        className={`absolute inset-0 bg-gradient-to-r from-[#0b0f19] via-[#111728] to-[#1e1b4b] transition-opacity duration-500 ${
          isDark ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
      >
        {/* Twinkling Stars on the Left */}
        <div className="absolute left-2.5 top-2 w-1 h-1 rounded-full bg-white shadow-[0_0_3px_white] animate-pulse" />
        <div className="absolute left-5 top-4 w-0.5 h-0.5 rounded-full bg-cyan-200" />
        <div className="absolute left-7 top-1.5 w-1 h-1 rounded-full bg-amber-200/90 shadow-[0_0_2px_#fde68a]" style={{ animationDuration: '2.5s' }} />
        <div className="absolute left-4 top-5 w-0.5 h-0.5 rounded-full bg-purple-200" />
      </div>

      {/* ============================================================ */}
      {/* 2. LAYERED CLOUDS (Puffy clouds at the bottom)               */}
      {/* ============================================================ */}
      <div 
        className={`absolute inset-x-0 bottom-0 h-4 pointer-events-none transition-all duration-500 ${
          isDark 
            ? 'translate-y-0.5 opacity-60' 
            : 'translate-y-0 opacity-95'
        }`}
      >
        {/* Cloud Bubble 1 */}
        <div 
          className={`absolute -bottom-2 left-1 w-6 h-6 rounded-full transition-colors duration-500 ${
            isDark ? 'bg-[#212644]' : 'bg-white shadow-xs'
          }`} 
        />
        {/* Cloud Bubble 2 */}
        <div 
          className={`absolute -bottom-1.5 left-5 w-5 h-5 rounded-full transition-colors duration-500 ${
            isDark ? 'bg-[#1a1e38]' : 'bg-white/95'
          }`} 
        />
        {/* Cloud Bubble 3 */}
        <div 
          className={`absolute -bottom-2.5 left-8 w-7 h-7 rounded-full transition-colors duration-500 ${
            isDark ? 'bg-[#272d4d]' : 'bg-white shadow-xs'
          }`} 
        />
        {/* Cloud Bubble 4 (Rightmost) */}
        <div 
          className={`absolute -bottom-2 right-0.5 w-6 h-6 rounded-full transition-colors duration-500 ${
            isDark ? 'bg-[#1e2240]' : 'bg-white/90'
          }`} 
        />
      </div>

      {/* ============================================================ */}
      {/* 3. SLIDING CELESTIAL ORB (Sun in Day, Moon in Night)         */}
      {/* ============================================================ */}
      <div
        className={`relative z-10 w-[24px] h-[24px] rounded-full transition-all duration-500 cubic-bezier(0.34, 1.56, 0.64, 1) flex items-center justify-center ${
          isDark
            ? 'translate-x-[30px] bg-gradient-to-tr from-slate-100 via-white to-slate-200 shadow-[0_0_10px_rgba(255,255,255,0.85),0_0_16px_rgba(168,85,247,0.35)]'
            : 'translate-x-0 bg-gradient-to-tr from-amber-100 via-white to-amber-200 shadow-[0_0_10px_rgba(255,255,255,0.9),0_0_14px_rgba(251,191,36,0.6)]'
        }`}
      >
        {/* Details inside the Orb */}
        {isDark ? (
          /* Moon icon */
          <div className="w-full h-full relative rounded-full overflow-hidden flex items-center justify-center transition-opacity duration-300">
            <Moon size={13} className="text-indigo-900 fill-indigo-950/30" />
          </div>
        ) : (
          /* Sun icon */
          <div className="w-full h-full relative rounded-full overflow-hidden flex items-center justify-center transition-opacity duration-300">
            <Sun size={13} className="text-amber-600 fill-amber-300/40" />
          </div>
        )}
      </div>

    </button>
  );
}

export default DayNightSwitch;
