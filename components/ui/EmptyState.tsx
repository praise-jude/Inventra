import Link from "next/link";

interface EmptyStateProps {
  icon?: string;
  title: string;
  description?: string;
  action?: { label: string; href: string } | { label: string; onClick: () => void };
  compact?: boolean;
}

export function EmptyState({ icon = "📭", title, description, action, compact = false }: EmptyStateProps) {
  return (
    <div className={`flex flex-col items-center justify-center text-center ${compact ? "py-8" : "py-14"}`}>
      <div
        aria-hidden="true"
        className="mb-3 flex h-12 w-12 items-center justify-center rounded-[13px] bg-accent-weak text-[22px]"
      >
        {icon}
      </div>
      <div className="text-[14px] font-bold text-text">{title}</div>
      {description && <div className="mt-1 max-w-[320px] text-[12.5px] leading-snug text-muted">{description}</div>}
      {action && (
        <div className="mt-4">
          {"href" in action ? (
            <Link
              href={action.href}
              className="inline-flex h-9 items-center rounded-[9px] bg-accent px-4 text-[13px] font-semibold text-white shadow-[var(--shadow-sm)] hover:brightness-[1.06]"
            >
              {action.label}
            </Link>
          ) : (
            <button
              onClick={action.onClick}
              className="inline-flex h-9 items-center rounded-[9px] bg-accent px-4 text-[13px] font-semibold text-white shadow-[var(--shadow-sm)] hover:brightness-[1.06]"
            >
              {action.label}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
