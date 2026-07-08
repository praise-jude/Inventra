"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/app/ToastProvider";
import { updateSale } from "@/lib/actions/sales";
import type { SaleDetail } from "@/lib/queries/sales";
import type { CustomerOption } from "@/lib/queries/customers";
import { Field } from "@/components/ui/Field";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";

const PAYMENT_OPTIONS = [
  { value: "cash", label: "Cash" },
  { value: "card", label: "Card" },
  { value: "bank_transfer", label: "Bank Transfer" },
  { value: "mobile_money", label: "Mobile Money" },
];

export function SaleEditModal({
  sale,
  customers,
  paymentMethod,
  onClose,
}: {
  sale: SaleDetail;
  customers: CustomerOption[];
  paymentMethod: string | null;
  onClose: () => void;
}) {
  const router = useRouter();
  const flash = useToast();
  const [customerMode, setCustomerMode] = useState<"walkin" | "existing">(sale.customerId ? "existing" : "walkin");
  const [customerId, setCustomerId] = useState(sale.customerId ?? customers[0]?.id ?? "");
  const [notes, setNotes] = useState(sale.notes ?? "");
  const [method, setMethod] = useState(paymentMethod ?? "cash");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      await updateSale(sale.id, {
        customerId: customerMode === "existing" ? customerId : undefined,
        notes,
        paymentMethod: method,
      });
      flash("Sale updated");
      onClose();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update the sale.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      onClick={onClose}
      className="animate-fade-in fixed inset-0 z-[75] flex items-center justify-center bg-[rgba(15,20,32,.45)] p-6 backdrop-blur-sm"
    >
      <form
        onClick={(e) => e.stopPropagation()}
        onSubmit={handleSubmit}
        className="animate-scale-in w-full max-w-[500px] rounded-2xl border border-border bg-surface shadow-[var(--shadow-lg)]"
      >
        <div className="flex items-center justify-between border-b border-border px-[22px] py-[18px]">
          <div className="text-[16px] font-bold">Edit sale</div>
          <button type="button" onClick={onClose} className="h-8 w-8 rounded-[8px] border border-border bg-surface text-text">
            ✕
          </button>
        </div>
        <div className="flex flex-col gap-3.5 px-[22px] py-5">
          <div className="flex items-center justify-between">
            <div className="text-[13px] font-bold text-text-2">Customer</div>
            <div className="flex gap-1.5 rounded-[9px] border border-border p-1">
              <button
                type="button"
                onClick={() => setCustomerMode("walkin")}
                className="rounded-[7px] px-3 py-1 text-[12.5px] font-semibold"
                style={{ background: customerMode === "walkin" ? "var(--accent-weak)" : "transparent", color: customerMode === "walkin" ? "var(--accent-text)" : "var(--text-2)" }}
              >
                Walk-in
              </button>
              <button
                type="button"
                onClick={() => setCustomerMode("existing")}
                className="rounded-[7px] px-3 py-1 text-[12.5px] font-semibold"
                style={{ background: customerMode === "existing" ? "var(--accent-weak)" : "transparent", color: customerMode === "existing" ? "var(--accent-text)" : "var(--text-2)" }}
              >
                Existing customer
              </button>
            </div>
          </div>
          {customerMode === "walkin" ? (
            <p className="text-[13px] text-muted">Walk-in sales don&apos;t require any customer details.</p>
          ) : (
            <Select label="Customer" value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
              {customers.length === 0 && <option value="">No customers yet</option>}
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                  {c.phone ? ` · ${c.phone}` : ""}
                </option>
              ))}
            </Select>
          )}
          <Select label="Payment method" value={method} onChange={(e) => setMethod(e.target.value)}>
            {PAYMENT_OPTIONS.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </Select>
          <Field label="Notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
          {error && <p className="text-[13px] font-medium text-red">{error}</p>}
        </div>
        <div className="flex justify-end gap-2.5 border-t border-border px-[22px] py-4">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={saving}>
            {saving ? "Saving…" : "Save changes"}
          </Button>
        </div>
      </form>
    </div>
  );
}
