"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/app/ToastProvider";
import { createDebtor, updateDebtor } from "@/lib/actions/debtors";
import type { DebtorRow } from "@/lib/queries/debtors";
import { Field } from "@/components/ui/Field";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";

const STATUS_OPTIONS = [
  { value: "pending", label: "Pending" },
  { value: "partially_paid", label: "Partially Paid" },
  { value: "paid", label: "Paid" },
  { value: "overdue", label: "Overdue" },
  { value: "cancelled", label: "Cancelled" },
];

export function DebtorModal({ debtor, onClose }: { debtor?: DebtorRow; onClose: () => void }) {
  const router = useRouter();
  const flash = useToast();
  const [form, setForm] = useState({
    customerName: debtor?.customerName ?? "",
    phone: debtor?.phone ?? "",
    email: debtor?.email ?? "",
    amountOwed: debtor ? String(debtor.amountOwed) : "",
    dueDate: debtor?.dueDate ?? "",
    notes: debtor?.notes ?? "",
    status: debtor?.status ?? "pending",
  });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function set<K extends keyof typeof form>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      if (debtor) {
        await updateDebtor(debtor.id, {
          customerName: form.customerName,
          phone: form.phone,
          email: form.email,
          amountOwed: debtor.amountOwed,
          dueDate: form.dueDate,
          notes: form.notes,
          status: form.status,
        });
        flash("Debtor updated");
      } else {
        await createDebtor({
          customerName: form.customerName,
          phone: form.phone,
          email: form.email,
          amountOwed: parseFloat(form.amountOwed) || 0,
          dueDate: form.dueDate,
          notes: form.notes,
        });
        flash("Debtor added");
      }
      onClose();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save the debtor.");
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
          <div className="text-[16px] font-bold">{debtor ? "Edit debtor" : "New debtor"}</div>
          <button type="button" onClick={onClose} className="h-8 w-8 rounded-[8px] border border-border bg-surface text-text">
            ✕
          </button>
        </div>
        <div className="flex flex-col gap-3.5 px-[22px] py-5">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Customer name" value={form.customerName} onChange={(e) => set("customerName", e.target.value)} required />
            <Field label="Phone number" value={form.phone} onChange={(e) => set("phone", e.target.value)} />
            <Field label="Email" type="email" value={form.email} onChange={(e) => set("email", e.target.value)} />
            {debtor ? (
              <div>
                <label className="mb-1.5 block text-[12.5px] font-semibold text-text-2">Status</label>
                <Select value={form.status} onChange={(e) => set("status", e.target.value)}>
                  {STATUS_OPTIONS.map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                </Select>
              </div>
            ) : (
              <Field
                label="Amount owed"
                type="number"
                step="0.01"
                value={form.amountOwed}
                onChange={(e) => set("amountOwed", e.target.value)}
                required
              />
            )}
            <Field label="Due date" type="date" value={form.dueDate} onChange={(e) => set("dueDate", e.target.value)} />
          </div>
          <Field label="Notes" value={form.notes} onChange={(e) => set("notes", e.target.value)} />
          {error && <p className="text-[13px] font-medium text-red">{error}</p>}
        </div>
        <div className="flex justify-end gap-2.5 border-t border-border px-[22px] py-4">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={saving}>
            {saving ? "Saving…" : debtor ? "Save changes" : "Add debtor"}
          </Button>
        </div>
      </form>
    </div>
  );
}
