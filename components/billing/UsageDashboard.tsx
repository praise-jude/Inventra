import type { Entitlements } from "@/lib/entitlements";

function UsageBar({ label, used, limit }: { label: string; used: number; limit: number }) {
  const pct = limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 0;
  const nearLimit = pct >= 90;
  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between text-[12.5px]">
        <span className="font-semibold text-text">{label}</span>
        <span className="font-mono text-text-2">
          {used.toLocaleString()} / {limit.toLocaleString()}
        </span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-border-2">
        <div
          className="h-full rounded-full transition-[width]"
          style={{ width: `${pct}%`, background: nearLimit ? "var(--red)" : "var(--accent)" }}
        />
      </div>
    </div>
  );
}

// Settings > Subscription usage dashboard — Current Plan + per-resource
// progress bars, per spec. Rendered above BillingClient on the Billing
// page (this app's Settings > Subscription equivalent).
export function UsageDashboard({ entitlements }: { entitlements: Entitlements }) {
  const isPremium = entitlements.tier === "premium";

  return (
    <div className="mb-5 rounded-2xl border border-border bg-surface p-5 shadow-[var(--shadow-sm)]">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-wide text-muted">Current Plan</div>
          <div className="text-[18px] font-bold text-text">{isPremium ? "Premium" : "Free"}</div>
        </div>
        {!isPremium && (
          <span className="rounded-full bg-accent-weak px-3 py-1 text-[11px] font-bold text-accent-text">Usage limits apply</span>
        )}
      </div>

      {isPremium ? (
        <p className="text-[13px] text-text-2">Unlimited products, sales, expenses, invoices, and customer credit records.</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          <UsageBar label="Products Used" used={entitlements.productCount} limit={entitlements.productLimit} />
          <UsageBar label="Sales Used" used={entitlements.salesCount} limit={entitlements.salesLimit} />
          <UsageBar label="Expenses Used" used={entitlements.expenseCount} limit={entitlements.expenseLimit} />
          <UsageBar label="Debt Records Used" used={entitlements.debtorCount} limit={entitlements.debtorLimit} />
          <UsageBar label="Invoices Used" used={entitlements.invoiceCount} limit={entitlements.invoiceLimit} />
        </div>
      )}
    </div>
  );
}
