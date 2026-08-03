"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { useToast } from "@/components/app/ToastProvider";
import { useEntitlementsContext } from "@/components/billing/EntitlementsProvider";
import { archiveWarehouse, deleteWarehouse, generateBranchCode, reactivateWarehouse, revokeBranchCode } from "@/lib/actions/warehouses";
import type { WarehouseOverview } from "@/lib/queries/inventory";
import { formatMoney, formatNumber } from "@/lib/format";
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
  canTransfer,
}: {
  warehouses: WarehouseOverview[];
  managers: ManagerOption[];
  currency: string;
  canManage: boolean;
  canDelete: boolean;
  canTransfer: boolean;
}) {
  const router = useRouter();
  const flash = useToast();
  const { isPremium, openUpgradeModal } = useEntitlementsContext();
  const [modalWarehouse, setModalWarehouse] = useState<WarehouseOverview | null | undefined>(undefined);
  const [transferFrom, setTransferFrom] = useState<WarehouseOverview | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function handleArchive(warehouse: WarehouseOverview) {
    if (!window.confirm(`Archive "${warehouse.name}"? It won't be selectable for new stock or sales until reactivated.`)) return;
    setBusyId(warehouse.id);
    try {
      await archiveWarehouse(warehouse.id);
      flash("Branch archived");
      router.refresh();
    } catch (err) {
      flash(err instanceof Error ? err.message : "Could not archive the branch.");
    } finally {
      setBusyId(null);
    }
  }

  async function handleReactivate(warehouse: WarehouseOverview) {
    setBusyId(warehouse.id);
    try {
      await reactivateWarehouse(warehouse.id);
      flash("Branch reactivated");
      router.refresh();
    } catch (err) {
      flash(err instanceof Error ? err.message : "Could not reactivate the branch.");
    } finally {
      setBusyId(null);
    }
  }

  async function handleDelete(warehouse: WarehouseOverview) {
    if (!window.confirm(`Permanently delete "${warehouse.name}"? This can't be undone.`)) return;
    setBusyId(warehouse.id);
    try {
      await deleteWarehouse(warehouse.id);
      flash("Branch deleted");
      router.refresh();
    } catch (err) {
      flash(err instanceof Error ? err.message : "Could not delete the branch.");
    } finally {
      setBusyId(null);
    }
  }

  async function handleGenerateCode(warehouse: WarehouseOverview) {
    const verb = warehouse.branchCode ? "Regenerate" : "Generate";
    if (warehouse.branchCode && !window.confirm(`${verb} the signup code for "${warehouse.name}"? The old code will stop working immediately.`)) return;
    setBusyId(warehouse.id);
    try {
      const { code } = await generateBranchCode(warehouse.id);
      await navigator.clipboard?.writeText(code).catch(() => {});
      flash(`New code ${code} copied to clipboard`);
      router.refresh();
    } catch (err) {
      flash(err instanceof Error ? err.message : "Could not generate a signup code.");
    } finally {
      setBusyId(null);
    }
  }

  async function handleRevokeCode(warehouse: WarehouseOverview) {
    if (!window.confirm(`Revoke the signup code for "${warehouse.name}"? Nobody will be able to use it to join anymore.`)) return;
    setBusyId(warehouse.id);
    try {
      await revokeBranchCode(warehouse.id);
      flash("Signup code revoked");
      router.refresh();
    } catch (err) {
      flash(err instanceof Error ? err.message : "Could not revoke the signup code.");
    } finally {
      setBusyId(null);
    }
  }

  async function handleCopyCode(code: string) {
    await navigator.clipboard?.writeText(code).catch(() => {});
    flash("Code copied to clipboard");
  }

  return (
    <div>
      {canManage && (
        <div className="mb-3.5 flex justify-end">
          <button
            onClick={() => (isPremium ? setModalWarehouse(null) : openUpgradeModal())}
            className="flex h-[37px] items-center gap-1.5 rounded-[9px] bg-accent px-[15px] text-[13px] font-semibold text-white shadow-[var(--shadow-sm)]"
          >
            + New branch
            {!isPremium && <span className="rounded-full bg-white/25 px-1.5 py-px text-[9.5px] font-bold">PRO</span>}
          </button>
        </div>
      )}

      {warehouses.length === 0 ? (
        <div className="rounded-2xl border border-border bg-surface shadow-[var(--shadow-sm)]">
          <EmptyState
            icon="🏬"
            title="No branches yet"
            description="Add a branch to start tracking stock by location."
            action={canManage ? { label: "New branch", onClick: () => (isPremium ? setModalWarehouse(null) : openUpgradeModal()) } : undefined}
          />
        </div>
      ) : (
      <div className="grid gap-3.5" style={{ gridTemplateColumns: "repeat(auto-fill,minmax(280px,1fr))" }}>
        {warehouses.map((w) => {
          const color = w.utilizationPct >= 70 ? "var(--amber)" : "var(--green)";
          const colorWeak = w.utilizationPct >= 70 ? "var(--amber-weak)" : "var(--green-weak)";
          const isArchived = w.status === "inactive";
          const location = [w.address, w.state, w.country].filter(Boolean).join(", ");
          return (
            <div key={w.id} className="rounded-2xl border border-border bg-surface p-[18px] shadow-[var(--shadow-sm)]" style={isArchived ? { opacity: 0.65 } : undefined}>
              <div className="mb-1 flex items-center justify-between gap-1.5">
                <div className="text-[15px] font-bold">{w.name}</div>
                <div className="flex items-center gap-1.5">
                  {isArchived && (
                    <span className="rounded-[20px] px-2 py-px text-[11px] font-bold" style={{ color: "var(--muted)", background: "var(--hover)" }}>
                      Archived
                    </span>
                  )}
                  <span className="rounded-[20px] px-2 py-px text-[11px] font-bold" style={{ color, background: colorWeak }}>
                    {w.utilizationPct}%
                  </span>
                </div>
              </div>
              <div className="mb-1 text-[12.5px] text-muted">{location || "—"}</div>
              <div className="mb-3.5 text-[12.5px] text-muted">
                {w.phone ?? "No phone"} · {w.managerName ?? "Unassigned"}
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
                <span className="font-mono font-bold">{formatMoney(w.stockValue, currency)}</span>
              </div>

              {canManage && (
                <div className="mt-3.5 border-t border-border pt-3">
                  <div className="mb-1.5 text-[11px] font-semibold text-text-2">Signup code</div>
                  {w.branchCode ? (
                    <div className="flex items-center justify-between gap-2">
                      <button
                        onClick={() => handleCopyCode(w.branchCode!)}
                        title="Copy code"
                        className="rounded-[7px] border border-border bg-hover px-2.5 py-1 font-mono text-[13px] font-bold tracking-wide text-text hover:bg-border-2"
                      >
                        {w.branchCode}
                      </button>
                      <div className="flex gap-1.5">
                        <button
                          onClick={() => handleGenerateCode(w)}
                          disabled={busyId === w.id}
                          className="h-6 rounded-[6px] border border-border bg-surface px-2 text-[11px] font-semibold text-text hover:bg-hover disabled:opacity-50"
                        >
                          Regenerate
                        </button>
                        <button
                          onClick={() => handleRevokeCode(w)}
                          disabled={busyId === w.id}
                          className="h-6 rounded-[6px] border border-border bg-surface px-2 text-[11px] font-semibold text-red hover:bg-hover disabled:opacity-50"
                        >
                          Revoke
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={() => handleGenerateCode(w)}
                      disabled={busyId === w.id}
                      className="h-7 w-full rounded-[7px] border border-border bg-surface text-[12px] font-semibold text-text hover:bg-hover disabled:opacity-50"
                    >
                      Generate signup code
                    </button>
                  )}
                  <div className="mt-1 text-[10.5px] text-muted">Anyone with this code can join as a branch manager — share it only with who you intend to.</div>
                </div>
              )}

              {(canManage || canTransfer) && (
                <div className="mt-3.5 flex flex-wrap gap-2 border-t border-border pt-3">
                  {canManage && (
                    <button
                      onClick={() => setModalWarehouse(w)}
                      className="h-7 flex-1 rounded-[7px] border border-border bg-surface text-[12px] font-semibold text-text hover:bg-hover"
                    >
                      Edit
                    </button>
                  )}
                  {canTransfer && (
                    <button
                      onClick={() => setTransferFrom(w)}
                      disabled={warehouses.length < 2}
                      className="h-7 flex-1 rounded-[7px] border border-border bg-surface text-[12px] font-semibold text-text hover:bg-hover disabled:opacity-50"
                    >
                      Transfer
                    </button>
                  )}
                  {canManage && (
                    <button
                      onClick={() => (isArchived ? handleReactivate(w) : handleArchive(w))}
                      disabled={busyId === w.id}
                      className="h-7 flex-1 rounded-[7px] border border-border bg-surface text-[12px] font-semibold text-text hover:bg-hover disabled:opacity-50"
                    >
                      {isArchived ? "Reactivate" : "Archive"}
                    </button>
                  )}
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
