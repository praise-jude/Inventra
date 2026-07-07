import { SelectHTMLAttributes, forwardRef, useId } from "react";

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { label, error, className = "", children, id, ...props },
  ref,
) {
  const autoId = useId();
  const selectId = id ?? autoId;
  const errorId = error ? `${selectId}-error` : undefined;
  return (
    <div>
      {label && (
        <label htmlFor={selectId} className="mb-1.5 block text-[12.5px] font-semibold text-text-2">
          {label}
        </label>
      )}
      <select
        ref={ref}
        id={selectId}
        aria-invalid={error ? true : undefined}
        aria-describedby={errorId}
        className={`h-[42px] w-full rounded-[9px] border bg-surface px-[13px] text-[14px] text-text outline-none transition-shadow focus:shadow-[0_0_0_3px_var(--accent-weak)] ${error ? "border-red focus:border-red" : "border-border focus:border-accent"} ${className}`}
        {...props}
      >
        {children}
      </select>
      {error && (
        <p id={errorId} className="mt-1.5 text-[12px] font-medium text-red">
          {error}
        </p>
      )}
    </div>
  );
});
