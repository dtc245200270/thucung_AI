import React, { useEffect } from 'react';
import { X } from 'lucide-react';
import { sound } from '../../../services/soundService';

/**
 * Modal
 * Unified responsive modal dialog.
 * - Standard sizes: 'md' (max-w-2xl ~640px), 'lg' (max-w-3xl ~760px)
 * - Fixed header & footer, scrollable middle content
 * - max-height: 90vh
 * - Escape key dismiss and backdrop click
 */
export const Modal = ({
  isOpen,
  onClose,
  title,
  subtitle = null,
  children,
  footer = null,
  size = 'md', // 'sm' (max-w-md), 'md' (max-w-2xl 640px), 'lg' (max-w-3xl 760px), 'xl' (max-w-4xl)
  className = ''
}) => {
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        try { sound?.playPop?.(); } catch {}
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const sizeClasses = {
    sm: 'max-w-md',
    md: 'max-w-2xl', // 640px
    lg: 'max-w-3xl', // 760px
    xl: 'max-w-4xl'
  };

  const handleClose = () => {
    try { sound?.playPop?.(); } catch {}
    onClose();
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/40 backdrop-blur-sm animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
    >
      <div 
        className="fixed inset-0" 
        onClick={handleClose} 
      />

      <div className={`relative w-full ${sizeClasses[size] || sizeClasses.md} max-h-[90vh] bg-white dark:bg-slate-900 rounded-3xl border border-[#E2E8F0] dark:border-white/10 shadow-2xl flex flex-col overflow-hidden z-10 animate-in zoom-in-95 duration-150 text-[#1E293B] dark:text-slate-100 ${className}`}>
        
        {/* Fixed Header */}
        <div className="shrink-0 flex items-center justify-between px-5 sm:px-6 py-4 border-b border-[#E2E8F0] dark:border-white/10">
          <div className="min-w-0 pr-3">
            <h2 className="text-lg sm:text-xl font-bold text-[#0F172A] dark:text-white truncate">
              {title}
            </h2>
            {subtitle && (
              <p className="text-xs sm:text-sm text-[#475569] dark:text-slate-400 truncate mt-0.5">
                {subtitle}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="w-8 h-8 rounded-xl flex items-center justify-center text-[#475569] hover:text-[#0F172A] hover:bg-slate-100 dark:text-slate-400 dark:hover:text-white dark:hover:bg-white/10 transition-colors cursor-pointer"
            aria-label="Đóng cửa sổ"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Middle Content */}
        <div className="flex-1 overflow-y-auto px-5 sm:px-6 py-5 custom-scrollbar space-y-4 text-[#1E293B] dark:text-slate-100">
          {children}
        </div>

        {/* Fixed Footer */}
        {footer && (
          <div className="shrink-0 flex items-center justify-end gap-3 px-5 sm:px-6 py-3.5 border-t border-[#E2E8F0] dark:border-white/10 bg-[#F8FAFC] dark:bg-slate-950/40">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
};

export default Modal;
