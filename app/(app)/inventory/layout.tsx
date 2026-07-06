import Link from "next/link";
import { getInventoryCards } from "@/lib/queries/inventory";
import { InventoryTabs } from "@/components/inventory/InventoryTabs";
import { formatNumber } from "@/lib/format";

export default async function InventoryLayout({ children }: { children: React.ReactNode }) {
  const cards = await getInventoryCards();

  return (
    <div className="animate-fade-up">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3.5">
        <div>
          <div className="text-[22px] font-bold tracking-tight">Inventory</div>
          <div className="mt-[3px] text-text-2">Live stock levels and full movement history.</div>
        </div>
        <Link
          href="/inventory/adjustments?new=1"
          className="flex h-[37px] items-center rounded-[9px] bg-accent px-[15px] text-[13px] font-semibold text-white shadow-[var(--shadow-sm)]"
        >
          + Stock adjustment
        </Link>
      </div>

      <div className="mb-[18px] grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fill,minmax(158px,1fr))" }}>
        {cards.map((c) => (
          <div key={c.label} className="rounded-[13px] border border-border bg-surface p-[14px_15px] shadow-[var(--shadow-sm)]">
            <div className="mb-2.5 flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-[7px] text-[12px]" style={{ background: c.bg }}>
                {c.icon}
              </span>
              <span className="text-[12px] font-semibold text-text-2">{c.label}</span>
            </div>
            <div className="font-mono text-[22px] font-bold tracking-tight">{formatNumber(c.value)}</div>
            <div className="mt-0.5 text-[11.5px] text-muted">{c.sub}</div>
          </div>
        ))}
      </div>

      <InventoryTabs />
      {children}
    </div>
  );
}
