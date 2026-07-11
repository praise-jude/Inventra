import type { SubscriptionStatus } from "@/lib/supabase/database.types";

const STATUS_STYLE: Record<SubscriptionStatus | "legacy", { label: string; color: string; background: string }> = {
  trialing: { label: "Free trial", color: "var(--accent-text)", background: "var(--accent-weak)" },
  active: { label: "Active", color: "var(--green)", background: "var(--green-weak)" },
  past_due: { label: "Past due", color: "var(--amber)", background: "var(--amber-weak)" },
  payment_failed: { label: "Payment failed", color: "var(--red)", background: "var(--red-weak)" },
  suspended: { label: "Suspended", color: "var(--red)", background: "var(--red-weak)" },
  cancelled: { label: "Cancelled", color: "var(--muted)", background: "var(--hover)" },
  expired: { label: "Expired", color: "var(--muted)", background: "var(--hover)" },
  legacy: { label: "Active", color: "var(--green)", background: "var(--green-weak)" },
};

export function SubscriptionStatusBadge({ status }: { status: SubscriptionStatus | "legacy" }) {
  const style = STATUS_STYLE[status] ?? STATUS_STYLE.active;
  return (
    <span
      className="inline-flex items-center rounded-[20px] px-[10px] py-[3px] text-[11.5px] font-bold uppercase tracking-[0.03em]"
      style={{ color: style.color, background: style.background }}
    >
      {style.label}
    </span>
  );
}
