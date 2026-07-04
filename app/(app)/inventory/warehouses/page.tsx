import { getWarehousesOverview } from "@/lib/queries/inventory";
import { requireProfile } from "@/lib/queries/session";
import { formatMoneyCompact, formatNumber } from "@/lib/format";

export default async function WarehousesPage() {
  const [warehouses, { org }] = await Promise.all([getWarehousesOverview(), requireProfile()]);

  return (
    <div className="grid gap-3.5" style={{ gridTemplateColumns: "repeat(auto-fill,minmax(280px,1fr))" }}>
      {warehouses.map((w) => {
        const color = w.utilizationPct >= 70 ? "var(--amber)" : "var(--green)";
        const colorWeak = w.utilizationPct >= 70 ? "var(--amber-weak)" : "var(--green-weak)";
        return (
          <div key={w.id} className="rounded-2xl border border-border bg-surface p-[18px] shadow-[var(--shadow-sm)]">
            <div className="mb-1 flex items-center justify-between">
              <div className="text-[15px] font-bold">{w.name}</div>
              <span
                className="rounded-[20px] px-2 py-px text-[11px] font-bold"
                style={{ color, background: colorWeak }}
              >
                {w.utilizationPct}%
              </span>
            </div>
            <div className="mb-3.5 text-[12.5px] text-muted">
              {w.address ?? "—"} · {w.managerName ?? "Unassigned"}
            </div>
            <div className="mb-3.5 h-2 overflow-hidden rounded-[6px] bg-border-2">
              <div className="h-full rounded-[6px] bg-accent" style={{ width: `${w.utilizationPct}%` }} />
            </div>
            <div className="flex justify-between text-[12.5px]">
              <span className="text-text-2">SKUs</span>
              <span className="font-mono font-bold">{formatNumber(w.skuCount)}</span>
            </div>
            <div className="mt-1.5 flex justify-between text-[12.5px]">
              <span className="text-text-2">Stock value</span>
              <span className="font-mono font-bold">{formatMoneyCompact(w.stockValue, org.currency)}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
