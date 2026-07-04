import { SelectHTMLAttributes, forwardRef } from "react";

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { label, className = "", children, ...props },
  ref,
) {
  return (
    <div>
      {label && (
        <label className="mb-1.5 block text-[12.5px] font-semibold text-text-2">{label}</label>
      )}
      <select
        ref={ref}
        className={`h-[42px] w-full rounded-[9px] border border-border bg-surface px-[13px] text-[14px] text-text outline-none transition-shadow focus:border-accent focus:shadow-[0_0_0_3px_var(--accent-weak)] ${className}`}
        {...props}
      >
        {children}
      </select>
    </div>
  );
});
