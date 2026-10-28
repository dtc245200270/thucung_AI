import React from 'react';

/**
 * FormField
 * Standard form layout wrapper and accessible input primitives.
 * - Standard height: minimum 44px (min-h-[44px] h-11)
 * - Standard radius: 10-12px (rounded-xl)
 * - Clean borders: #E5E7EB (dark: #344039)
 * - Clear labels and semantic validation
 */
export const FormField = ({
  label,
  required = false,
  error = null,
  hint = null,
  children,
  className = ''
}) => {
  return (
    <div className={`space-y-1.5 ${className}`}>
      {label && (
        <label className="block text-xs sm:text-sm font-semibold text-[#18201D] dark:text-[#F1F5F2]">
          {label} {required && <span className="text-rose-500">*</span>}
        </label>
      )}
      {children}
      {error && (
        <p className="text-xs text-rose-500 font-medium">{error}</p>
      )}
      {hint && !error && (
        <p className="text-xs text-[#64716B] dark:text-[#9AA8A0]">{hint}</p>
      )}
    </div>
  );
};

export const Input = React.forwardRef(({
  className = '',
  error = false,
  ...props
}, ref) => {
  return (
    <input
      ref={ref}
      className={`w-full min-h-[44px] h-11 px-3.5 rounded-xl border bg-white dark:bg-[#1D2520] text-[#18201D] dark:text-[#F1F5F2] text-sm placeholder:text-[#64716B]/60 dark:placeholder:text-[#9AA8A0]/50 transition-colors focus:outline-hidden focus:ring-2 focus:ring-[#202421]/15 dark:focus:ring-white/10 ${
        error
          ? 'border-rose-400 dark:border-rose-500 focus:border-rose-500'
          : 'border-[#E5E7EB] dark:border-[#344039] focus:border-[#202421] dark:focus:border-white/40'
      } ${className}`}
      {...props}
    />
  );
});
Input.displayName = 'Input';

export const Select = React.forwardRef(({
  className = '',
  error = false,
  children,
  ...props
}, ref) => {
  return (
    <select
      ref={ref}
      className={`w-full min-h-[44px] h-11 px-3.5 rounded-xl border bg-white dark:bg-[#1D2520] text-[#18201D] dark:text-[#F1F5F2] text-sm transition-colors focus:outline-hidden focus:ring-2 focus:ring-[#202421]/15 dark:focus:ring-white/10 cursor-pointer ${
        error
          ? 'border-rose-400 dark:border-rose-500 focus:border-rose-500'
          : 'border-[#E5E7EB] dark:border-[#344039] focus:border-[#202421] dark:focus:border-white/40'
      } ${className}`}
      {...props}
    >
      {children}
    </select>
  );
});
Select.displayName = 'Select';

export const Textarea = React.forwardRef(({
  className = '',
  error = false,
  rows = 3,
  ...props
}, ref) => {
  return (
    <textarea
      ref={ref}
      rows={rows}
      className={`w-full p-3 rounded-xl border bg-white dark:bg-[#1D2520] text-[#18201D] dark:text-[#F1F5F2] text-sm placeholder:text-[#64716B]/60 dark:placeholder:text-[#9AA8A0]/50 transition-colors focus:outline-hidden focus:ring-2 focus:ring-[#202421]/15 dark:focus:ring-white/10 resize-y ${
        error
          ? 'border-rose-400 dark:border-rose-500 focus:border-rose-500'
          : 'border-[#E5E7EB] dark:border-[#344039] focus:border-[#202421] dark:focus:border-white/40'
      } ${className}`}
      {...props}
    />
  );
});
Textarea.displayName = 'Textarea';

export default FormField;

