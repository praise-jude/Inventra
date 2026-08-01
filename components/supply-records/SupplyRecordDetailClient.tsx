"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useToast } from "@/components/app/ToastProvider";
import { useWorkspace } from "@/components/app/CurrencyProvider";
import { changeSupplyRecordStatus, softDeleteSupplyRecord } from "@/lib/actions/supply-records";
import type { SupplyRecordDetail } from "@/lib/queries/supply-records";
import { Button } from "@/components/ui/Button";

const STATUS_STYLE: Record<string, { color: string; background: string; label: string }> = {
  pending: { color: "var(--amber)", background: "var(--amber-weak)", label: "Pending" },
  received: { color: "var(--sky)", background: "var(--sky-weak)", label: "Received" },
  verified: { color: "var(--green)", background: "var(--green-weak)", label: "Verified" },
  cancelled: { color: "var(--red)", background: "var(--red-weak)", label: "Cancelled" },
};

const NEXT_STATUS: Record<string, { value: "received" | "verified" | "cancelled"; label: string }[]> = {
  pending: [
    { value: "received", label: "Mark Received" },
    { value: "cancelled", label: "Cancel" },
  ],
  received: [
    { value: "verified", label: "Mark Verified" },
    { value: "cancelled", label: "Cancel" },
  ],
  verified: [{ value: "cancelled", label: "Cancel" }],
  cancelled: [],
};

export function SupplyRecordDetailClient({ record, isManager }: { record: SupplyRecordDetail; isManager: boolean }) {
  const router = useRouter();
  const flash = useToast();
  const { format: formatMoney, formatShortDate } = useWorkspace();
  const [busy, setBusy] = useState(false);

  const style = STATUS_STYLE[record.status];

  async function handleStatusChange(next: "received" | "verified" | "cancelled") {
    if (next === "cancelled" && !window.confirm(`Cancel ${record.referenceNumber}? Any stock it already added will be reversed.`)) return;
    setBusy(true);
    try {
      await changeSupplyRecordStatus(record.id, next);
      flash(`Marked ${next}`);
      router.refresh();
    } catch (err) {
      flash(err instanceof Error ? err.message : "Could not update this supply record.");
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete() {
    if (!window.confirm(`Delete ${record.referenceNumber}? This can't be undone.`)) return;
    setBusy(true);
    try {
      await softDeleteSupplyRecord(record.id);
      flash("Supply record deleted");
      router.push("/inventory/supply-records");
    } catch (err) {
      flash(err instanceof Error ? err.message : "Could not delete this supply record.");
      setBusy(false);
    }
  }

  const canDelete = isManager && (record.status === "pending" || record.status === "cancelled");

  return (
    <div className="animate-fade-up">
      <Link href="/inventory/supply-records" className="mb-3 inline-block text-[12.5px] font-semibold text-accent-text">
        ‹ Back to Supply Records
      </Link>

      <div className="mb-[18px] flex flex-wrap items-start justify-between gap-3.5">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="text-[22px] font-bold tracking-tight">{record.referenceNumber}</div>
            <span className="rounded-[20px] px-[9px] py-0.5 text-[11.5px] font-bold" style={style}>
              {style?.label ?? record.status}
            </span>
          </div>
          <div className="mt-[3px] text-text-2">
            {record.supplierName} · {formatShortDate(record.dateSupplied)} · {record.warehouseName ?? "—"}
          </div>
        </div>
        {isManager && (
          <div className="flex gap-2">
            {NEXT_STATUS[record.status]?.map((n) => (
              <Button key={n.value} variant={n.value === "cancelled" ? "secondary" : "primary"} disabled={busy} onClick={() => handleStatusChange(n.value)}>
                {n.label}
              </Button>
            ))}
            {canDelete && (
              <Button variant="secondary" disabled={busy} onClick={handleDelete} className="border-none bg-red-weak text-red">
                Delete
              </Button>
            )}
          </div>
        )}
      </div>

      <div className="mb-4 grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fill,minmax(180px,1fr))" }}>
        <div className="rounded-[13px] border border-border bg-surface p-[14px_15px] shadow-[var(--shadow-sm)]">
          <div className="text-[12px] font-semibold text-text-2">Total quantity</div>
          <div className="mt-1.5 font-mono text-[19px] font-bold">{record.totalQuantity}</div>
        </div>
        <div className="rounded-[13px] border border-border bg-surface p-[14px_15px] shadow-[var(--shadow-sm)]">
          <div className="text-[12px] font-semibold text-text-2">Total amount</div>
          <div className="mt-1.5 font-mono text-[19px] font-bold">{formatMoney(record.totalAmount)}</div>
        </div>
        <div className="rounded-[13px] border border-border bg-surface p-[14px_15px] shadow-[var(--shadow-sm)]">
          <div className="text-[12px] font-semibold text-text-2">Invoice #</div>
          <div className="mt-1.5 text-[15px] font-bold">{record.invoiceNumber ?? "—"}</div>
        </div>
        <div className="rounded-[13px] border border-border bg-surface p-[14px_15px] shadow-[var(--shadow-sm)]">
          <div className="text-[12px] font-semibold text-text-2">Recorded by</div>
          <div className="mt-1.5 text-[15px] font-bold">{record.createdByName ?? "—"}</div>
        </div>
      </div>

      <div className="mb-4 rounded-2xl border border-border bg-surface p-[18px_20px] shadow-[var(--shadow-sm)]">
        <div className="mb-3.5 text-[15px] font-bold">Products</div>
        <div className="overflow-hidden rounded-[10px] border border-border">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-surface-2">
                <th className="px-3 py-2 text-left text-[11px] font-bold uppercase tracking-[0.04em] text-muted">Product</th>
                <th className="px-3 py-2 text-right text-[11px] font-bold uppercase tracking-[0.04em] text-muted">Quantity</th>
                <th className="px-3 py-2 text-right text-[11px] font-bold uppercase tracking-[0.04em] text-muted">Unit cost</th>
                <th className="px-3 py-2 text-right text-[11px] font-bold uppercase tracking-[0.04em] text-muted">Line total</th>
              </tr>
            </thead>
            <tbody>
              {record.items.map((i) => (
                <tr key={i.id} className="border-t border-border-2">
                  <td className="px-3 py-2 text-[13px] font-semibold">{i.productName}</td>
                  <td className="px-3 py-2 text-right font-mono text-[13px]">{i.quantity}</td>
                  <td className="px-3 py-2 text-right font-mono text-[13px]">{formatMoney(i.unitCost)}</td>
                  <td className="px-3 py-2 text-right font-mono text-[13px] font-bold">{formatMoney(i.lineTotal)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-surface p-[18px_20px] shadow-[var(--shadow-sm)]">
        <div className="mb-3.5 text-[15px] font-bold">Details</div>
        <div className="grid grid-cols-2 gap-3 text-[13px]">
          <div className="flex justify-between border-b border-border-2 py-1.5">
            <span className="text-text-2">Supplier phone</span>
            <span>{record.supplierPhone ?? "—"}</span>
          </div>
          <div className="flex justify-between border-b border-border-2 py-1.5">
            <span className="text-text-2">Supplier email</span>
            <span>{record.supplierEmail ?? "—"}</span>
          </div>
          {record.verifiedByName && (
            <div className="flex justify-between border-b border-border-2 py-1.5">
              <span className="text-text-2">Verified by</span>
              <span>
                {record.verifiedByName} {record.verifiedAt ? `· ${formatShortDate(record.verifiedAt)}` : ""}
              </span>
            </div>
          )}
          {record.cancelledByName && (
            <div className="flex justify-between border-b border-border-2 py-1.5">
              <span className="text-text-2">Cancelled by</span>
              <span>
                {record.cancelledByName} {record.cancelledAt ? `· ${formatShortDate(record.cancelledAt)}` : ""}
              </span>
            </div>
          )}
          {record.notes && (
            <div className="col-span-2 flex justify-between border-b border-border-2 py-1.5">
              <span className="text-text-2">Notes</span>
              <span>{record.notes}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
