"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/app/ToastProvider";
import { useWorkspace } from "@/components/app/CurrencyProvider";
import { deleteSale } from "@/lib/actions/sales";
import type { SaleDetail } from "@/lib/queries/sales";
import type { CustomerOption } from "@/lib/queries/customers";
import type { PaymentMethod } from "@/lib/supabase/database.types";
import { SaleEditModal } from "@/components/sales/SaleEditModal";

const PAYMENT_LABEL: Record<PaymentMethod, string> = {
  cash: "Cash",
  card: "Card",
  bank_transfer: "Bank Transfer",
  mobile_money: "Mobile Money",
};

export function SaleDetailSlideOver({
  sale,
  customers,
  canDelete,
  onClose,
}: {
  sale: SaleDetail;
  customers: CustomerOption[];
  canDelete: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const flash = useToast();
  const { format: formatMoney, formatDateTime } = useWorkspace();
  const [showEdit, setShowEdit] = useState(false);
  const [busy, setBusy] = useState(false);

  async function handleDelete() {
    if (!window.confirm("Delete this sale? Stock will be restocked and this can't be undone.")) return;
    setBusy(true);
    try {
      await deleteSale(sale.id);
      flash("Sale deleted");
      onClose();
      router.refresh();
    } catch (err) {
      flash(err instanceof Error ? err.message : "Could not delete the sale.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div onClick={onClose} className="animate-fade-in fixed inset-0 z-[70] bg-[rgba(15,20,32,.4)]" />
      <div className="scroll animate-slide-over fixed inset-y-0 right-0 z-[71] w-[460px] max-w-[92vw] overflow-y-auto border-l border-border bg-surface shadow-[var(--shadow-lg)]">
        <div className="sticky top-0 z-[2] flex items-center gap-3 border-b border-border bg-surface px-[22px] py-[18px]">
          <div className="flex h-11 w-11 items-center justify-center rounded-[11px] bg-accent-weak text-[20px]">🧾</div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-[16px] font-bold tracking-tight">{sale.customerName}</div>
            <div className="text-[12px] text-muted">{formatDateTime(sale.createdAt)}</div>
          </div>
          <button onClick={onClose} className="h-8 w-8 rounded-[8px] border border-border bg-surface text-[15px] text-text">
            ✕
          </button>
        </div>
        <div className="px-[22px] py-5">
          <div className="mb-5 flex gap-2">
            <button
              onClick={() => setShowEdit(true)}
              className="h-[38px] flex-1 rounded-[9px] bg-accent text-[13px] font-semibold text-white"
            >
              Edit
            </button>
            {canDelete && (
              <button
                onClick={handleDelete}
                disabled={busy}
                className="h-[38px] rounded-[9px] border border-border bg-surface px-3.5 text-[13px] font-semibold text-red"
              >
                Delete
              </button>
            )}
          </div>
          <div className="mb-2.5 text-[14px] font-bold">Items</div>
          <div className="mb-5 flex flex-col gap-2">
            {sale.items.map((i) => (
              <div key={i.id} className="flex items-center justify-between rounded-[10px] border border-border bg-surface-2 px-3 py-2.5">
                <div>
                  <div className="text-[13px] font-semibold">{i.productName}</div>
                  <div className="text-[11px] text-muted">
                    {i.qty} × {formatMoney(i.unitPrice)}
                  </div>
                </div>
                <div className="font-mono text-[13px] font-bold">{formatMoney(i.lineTotal)}</div>
              </div>
            ))}
          </div>

          <div className="mb-5 flex flex-col gap-1.5 rounded-xl border border-border p-3.5 text-[13px]">
            <div className="flex justify-between text-text-2">
              <span>Subtotal</span>
              <span className="font-mono">{formatMoney(sale.subtotal)}</span>
            </div>
            <div className="flex justify-between text-text-2">
              <span>Discount</span>
              <span className="font-mono">-{formatMoney(sale.discountAmount)}</span>
            </div>
            <div className="flex justify-between text-text-2">
              <span>Tax</span>
              <span className="font-mono">{formatMoney(sale.taxAmount)}</span>
            </div>
            <div className="flex justify-between border-t border-border pt-1.5 text-[15px] font-bold">
              <span>Total</span>
              <span className="font-mono">{formatMoney(sale.total)}</span>
            </div>
          </div>

          <div className="mb-2.5 text-[14px] font-bold">Payment</div>
          <div className="mb-5 flex flex-col gap-2">
            {sale.payments.map((p, i) => (
              <div key={i} className="flex items-center justify-between rounded-[10px] border border-border bg-surface-2 px-3 py-2.5">
                <div className="text-[13px] font-semibold">{PAYMENT_LABEL[p.method]}</div>
                <div className="font-mono text-[13px] font-bold">{formatMoney(p.amount)}</div>
              </div>
            ))}
          </div>

          {sale.notes && (
            <div className="rounded-[10px] border border-border bg-surface-2 px-3 py-2.5 text-[12.5px] text-text-2">{sale.notes}</div>
          )}
        </div>
      </div>
      {showEdit && (
        <SaleEditModal
          sale={sale}
          customers={customers}
          paymentMethod={sale.payments.length === 1 ? sale.payments[0].method : null}
          onClose={() => setShowEdit(false)}
        />
      )}
    </>
  );
}
