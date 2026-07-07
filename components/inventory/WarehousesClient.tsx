"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { useToast } from "@/components/app/ToastProvider";
import { deleteWarehouse } from "@/lib/actions/warehouses";
import type { WarehouseOverview } from "@/lib/queries/inventory";
import { formatMoneyCompact, formatNumber } from "@/lib/format";
import { EmptyState } from "@/components/ui/EmptyState";

const WarehouseModal = dynamic(() => import("@/components/inventory/WarehouseModal").then((m) => m.WarehouseModal));
const TransferStockModal = dynamic(() =>
  import("@/components/inventory/TransferStockModal").then((m) => m.TransferStockModal),
);

interface ManagerOption {
  id: string;
  name: string;
}

export function WarehousesClient({
  warehouses,
  managers,
  currency,
  canManage,
  canDelete,
}: {
  warehouses: WarehouseOverview[];
  managers: ManagerOption[];
  currency: string;
  canManage: boolean;
  canDelete: boolean;
}) {
  const router = useRouter();
  const flash = useToast();
  const [modalWarehouse, setModalWarehouse] = useState<WarehouseOverview | null | undefined>(undefined);
  const [transferFrom, setTransferFrom] = useState<WarehouseOverview | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function handleDelete(warehouse: WarehouseOverview) {
    if (!window.confirm(`Delete "${warehouse.name}"? This can't be undone.`)) return;
    setBusyId(warehouse.id);
    try {
      await deleteWarehouse(warehouse.id);
      flash("Warehouse deleted");
      router.refresh();
    } catch (err) {
      flash(err instanceof Error ? err.message : "Could not delete the warehouse.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div>
      {canManage && (
        <div className="mb-3.5 flex justify-end">
          <button
            onClick={() => setModalWarehouse(null)}
            className="h-[37px] rounded-[9px] bg-accent px-[15px] text-[13px] font-semibold text-white shadow-[var(--shadow-sm)]"
          >
            + New warehouse
          </button>
        </div>
      )}

      {warehouses.length === 0 ? (
        <div className="rounded-2xl border border-border bg-surface shadow-[var(--shadow-sm)]">
          <EmptyState
            icon="🏬"
            title="No warehouses yet"
            description="Add a warehouse to start tracking stock by location."
            action={canManage ? { label: "New warehouse", onClick: () => setModalWarehouse(null) } : undefined}
          />
        </div>
      ) : (
      <div className="grid gap-3.5" style={{ gridTemplateColumns: "repeat(auto-fill,minmax(280px,1fr))" }}>
        {warehouses.map((w) => {
          const color = w.utilizationPct >= 70 ? "var(--amber)" : "var(--green)";
          const colorWeak = w.utilizationPct >= 70 ? "var(--amber-weak)" : "var(--green-weak)";
          return (
            <div key={w.id} className="rounded-2xl border border-border bg-surface p-[18px] shadow-[var(--shadow-sm)]">
              <div className="mb-1 flex items-center justify-between">
                <div className="text-[15px] font-bold">{w.name}</div>
                <span className="rounded-[20px] px-2 py-px text-[11px] font-bold" style={{ color, background: colorWeak }}>
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
                <span className="font-mono font-bold">{formatMoneyCompact(w.stockValue, currency)}</span>
              </div>
              {canManage && (
                <div className="mt-3.5 flex gap-2 border-t border-border pt-3">
                  <button
                    onClick={() => setModalWarehouse(w)}
                    className="h-7 flex-1 rounded-[7px] border border-border bg-surface text-[12px] font-semibold text-text hover:bg-hover"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => setTransferFrom(w)}
                    disabled={warehouses.length < 2}
                    className="h-7 flex-1 rounded-[7px] border border-border bg-surface text-[12px] font-semibold text-text hover:bg-hover disabled:opacity-50"
                  >
                    Transfer
                  </button>
                  {canDelete && (
                    <button
                      onClick={() => handleDelete(w)}
                      disabled={busyId === w.id}
                      className="h-7 flex-1 rounded-[7px] border border-border bg-surface text-[12px] font-semibold text-red hover:bg-hover"
                    >
                      Delete
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
      )}

      {modalWarehouse !== undefined && (
        <WarehouseModal warehouse={modalWarehouse ?? undefined} managers={managers} onClose={() => setModalWarehouse(undefined)} />
      )}
      {transferFrom && (
        <TransferStockModal
          fromWarehouse={transferFrom}
          destinations={warehouses.filter((w) => w.id !== transferFrom.id).map((w) => ({ id: w.id, name: w.name }))}
          onClose={() => setTransferFrom(null)}
        />
      )}
    </div>
  );
}
