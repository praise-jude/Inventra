import { ButtonHTMLAttributes } from "react";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost";
}

const base =
  "inline-flex items-center justify-center gap-2 rounded-[9px] font-semibold font-sans text-[14px] cursor-pointer transition-[filter,background] disabled:cursor-not-allowed disabled:opacity-60";

const variants: Record<NonNullable<ButtonProps["variant"]>, string> = {
  primary: "border-none bg-accent text-white shadow-[var(--shadow-sm)] hover:brightness-[1.06]",
  secondary: "border border-border bg-surface text-text hover:bg-hover",
  ghost: "border-none bg-transparent text-text-2 hover:bg-hover",
};

export function Button({ variant = "primary", className = "", ...props }: ButtonProps) {
  return <button className={`${base} ${variants[variant]} h-[44px] px-4 ${className}`} {...props} />;
}
