"use client";

import { useWorkspace } from "@/components/app/CurrencyProvider";
import type { SupplierDetail } from "@/lib/queries/suppliers";

export function SupplierDetailSlideOver({ supplier, onClose }: { supplier: SupplierDetail; onClose: () => void }) {
  const { format: formatMoney, formatShortDate } = useWorkspace();

  const facts = [
    { k: "Company", v: supplier.company ?? "—" },
    { k: "Contact person", v: supplier.contactPerson ?? "—" },
    { k: "Email", v: supplier.email ?? "—" },
    { k: "Phone", v: supplier.phone ?? "—" },
    { k: "Address", v: supplier.address ?? "—" },
    { k: "Total purchases", v: formatMoney(supplier.totalPurchases) },
  ];

  return (
    <>
      <div onClick={onClose} className="animate-fade-in fixed inset-0 z-[70] bg-[rgba(15,20,32,.4)]" />
      <div className="scroll animate-slide-over fixed inset-y-0 right-0 z-[71] w-[460px] max-w-[92vw] overflow-y-auto border-l border-border bg-surface shadow-[var(--shadow-lg)]">
        <div className="sticky top-0 z-[2] flex items-center gap-3 border-b border-border bg-surface px-[22px] py-[18px]">
          <div className="flex h-11 w-11 items-center justify-center rounded-[11px] bg-accent-weak text-[20px]">🚚</div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-[16px] font-bold tracking-tight">{supplier.name}</div>
            <div className="text-[12px] text-muted">{supplier.productCount} products supplied</div>
          </div>
          <button onClick={onClose} className="h-8 w-8 rounded-[8px] border border-border bg-surface text-[15px] text-text">
            ✕
          </button>
        </div>
        <div className="px-[22px] py-5">
          <div className="mb-5 grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-border bg-border">
            {facts.map((f) => (
              <div key={f.k} className="bg-surface p-[11px_13px]">
                <div className="text-[11px] font-semibold uppercase tracking-[0.04em] text-muted">{f.k}</div>
                <div className="mt-0.5 truncate text-[13.5px] font-semibold">{f.v}</div>
              </div>
            ))}
          </div>

          <div className="mb-2.5 text-[14px] font-bold">Products supplied</div>
          <div className="mb-5 flex flex-col gap-2">
            {supplier.products.length === 0 && (
              <div className="rounded-[10px] border border-border bg-surface-2 px-3 py-2.5 text-[13px] text-muted">
                No products linked to this supplier yet.
              </div>
            )}
            {supplier.products.map((p) => (
              <div key={p.id} className="flex items-center gap-[11px] rounded-[10px] border border-border bg-surface-2 px-3 py-2.5">
                <span className="flex h-[26px] w-[26px] items-center justify-center rounded-[7px] bg-accent-weak text-[12px]">
                  {p.emoji || "📦"}
                </span>
                <div className="flex-1">
                  <div className="text-[13px] font-semibold">{p.name}</div>
                  <div className="font-mono text-[11px] text-muted">{p.sku}</div>
                </div>
              </div>
            ))}
          </div>

          <div className="mb-2.5 text-[14px] font-bold">Purchase history</div>
          <div className="flex flex-col gap-2">
            {supplier.purchases.length === 0 && (
              <div className="rounded-[10px] border border-border bg-surface-2 px-3 py-2.5 text-[13px] text-muted">
                No receiving history yet.
              </div>
            )}
            {supplier.purchases.map((p) => (
              <div key={p.id} className="flex items-center gap-[11px] rounded-[10px] border border-border bg-surface-2 px-3 py-2.5">
                <div className="flex-1">
                  <div className="text-[13px] font-semibold">{p.productName}</div>
                  <div className="text-[11px] text-muted">
                    {formatShortDate(p.createdAt)} · {p.qty}× received
                  </div>
                </div>
                <div className="font-mono text-[13px] font-bold">{formatMoney(p.amount)}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
