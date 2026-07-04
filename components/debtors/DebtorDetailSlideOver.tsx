"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/app/ToastProvider";
import { useWorkspace } from "@/components/app/CurrencyProvider";
import { recordPayment } from "@/lib/actions/debtors";
import type { DebtorDetail } from "@/lib/queries/debtors";
import { Field } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";

const STATUS_STYLE: Record<string, { color: string; background: string }> = {
  pending: { color: "var(--sky)", background: "var(--sky-weak)" },
  partially_paid: { color: "var(--amber)", background: "var(--amber-weak)" },
  paid: { color: "var(--green)", background: "var(--green-weak)" },
  overdue: { color: "var(--red)", background: "var(--red-weak)" },
  cancelled: { color: "var(--muted)", background: "var(--hover)" },
};
const STATUS_LABEL: Record<string, string> = {
  pending: "Pending",
  partially_paid: "Partially Paid",
  paid: "Paid",
  overdue: "Overdue",
  cancelled: "Cancelled",
};

export function DebtorDetailSlideOver({ debtor, onClose }: { debtor: DebtorDetail; onClose: () => void }) {
  const router = useRouter();
  const flash = useToast();
  const { format: formatMoney, formatShortDate } = useWorkspace();
  const [amount, setAmount] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleRecordPayment(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const value = parseFloat(amount);
    if (!value || value <= 0) {
      setError("Enter a valid payment amount.");
      return;
    }
    setSaving(true);
    try {
      await recordPayment(debtor.id, value);
      flash("Payment recorded");
      setAmount("");
      onClose();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not record the payment.");
    } finally {
      setSaving(false);
    }
  }

  const facts = [
    { k: "Phone", v: debtor.phone ?? "—" },
    { k: "Email", v: debtor.email ?? "—" },
    { k: "Due date", v: debtor.dueDate ? formatShortDate(debtor.dueDate) : "—" },
    { k: "Outstanding", v: formatMoney(debtor.amountOwed) },
  ];

  return (
    <>
      <div onClick={onClose} className="animate-fade-in fixed inset-0 z-[70] bg-[rgba(15,20,32,.4)]" />
      <div className="scroll animate-slide-over fixed inset-y-0 right-0 z-[71] w-[460px] max-w-[92vw] overflow-y-auto border-l border-border bg-surface shadow-[var(--shadow-lg)]">
        <div className="sticky top-0 z-[2] flex items-center gap-3 border-b border-border bg-surface px-[22px] py-[18px]">
          <div className="flex h-11 w-11 items-center justify-center rounded-[11px] bg-accent-weak text-[20px]">🧾</div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-[16px] font-bold tracking-tight">{debtor.customerName}</div>
            <span
              className="mt-0.5 inline-flex items-center gap-1.5 rounded-[20px] px-[9px] py-px text-[11.5px] font-bold"
              style={STATUS_STYLE[debtor.status]}
            >
              {STATUS_LABEL[debtor.status]}
            </span>
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

          {debtor.notes && (
            <div className="mb-5 rounded-[10px] border border-border bg-surface-2 px-3 py-2.5 text-[12.5px] text-text-2">
              {debtor.notes}
            </div>
          )}

          {debtor.status !== "paid" && debtor.status !== "cancelled" && (
            <form onSubmit={handleRecordPayment} className="mb-5 rounded-xl border border-border bg-surface-2 p-3.5">
              <div className="mb-2.5 text-[13px] font-bold">Record payment</div>
              <div className="flex gap-2">
                <div className="flex-1">
                  <Field
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                  />
                </div>
                <Button type="submit" disabled={saving}>
                  {saving ? "Saving…" : "Record"}
                </Button>
              </div>
              {error && <p className="mt-2 text-[12px] font-medium text-red">{error}</p>}
            </form>
          )}

          <div className="mb-2.5 text-[14px] font-bold">Payment history</div>
          <div className="flex flex-col gap-2">
            {debtor.payments.length === 0 && (
              <div className="rounded-[10px] border border-border bg-surface-2 px-3 py-2.5 text-[13px] text-muted">
                No payments recorded yet.
              </div>
            )}
            {debtor.payments.map((p) => (
              <div key={p.id} className="flex items-center gap-[11px] rounded-[10px] border border-border bg-surface-2 px-3 py-2.5">
                <div className="flex-1">
                  <div className="text-[13px] font-semibold">{formatMoney(p.amount)}</div>
                  <div className="text-[11px] text-muted">{formatShortDate(p.paidAt)}{p.note ? ` · ${p.note}` : ""}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
