"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/app/ToastProvider";
import { createExpense, updateExpense } from "@/lib/actions/expenses";
import type { ExpenseRow } from "@/lib/queries/expenses";
import { Field } from "@/components/ui/Field";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";

const CATEGORY_OPTIONS = [
  { value: "rent", label: "Rent" },
  { value: "salary", label: "Salary" },
  { value: "transport", label: "Transport" },
  { value: "utilities", label: "Utilities" },
  { value: "inventory_purchase", label: "Inventory Purchase" },
  { value: "logistics", label: "Logistics" },
  { value: "miscellaneous", label: "Miscellaneous" },
];

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export function ExpenseModal({ expense, onClose }: { expense?: ExpenseRow; onClose: () => void }) {
  const router = useRouter();
  const flash = useToast();
  const [form, setForm] = useState({
    category: expense?.category ?? "miscellaneous",
    description: expense?.description ?? "",
    amount: expense ? String(expense.amount) : "",
    incurredAt: expense?.incurredAt ?? today(),
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
      const input = {
        category: form.category,
        description: form.description,
        amount: parseFloat(form.amount) || 0,
        incurredAt: form.incurredAt,
      };
      if (expense) {
        await updateExpense(expense.id, input);
        flash("Expense updated");
      } else {
        await createExpense(input);
        flash("Expense added");
      }
      onClose();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save the expense.");
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
        className="animate-scale-in w-full max-w-[440px] rounded-2xl border border-border bg-surface shadow-[var(--shadow-lg)]"
      >
        <div className="flex items-center justify-between border-b border-border px-[22px] py-[18px]">
          <div className="text-[16px] font-bold">{expense ? "Edit expense" : "New expense"}</div>
          <button type="button" onClick={onClose} className="h-8 w-8 rounded-[8px] border border-border bg-surface text-text">
            ✕
          </button>
        </div>
        <div className="flex flex-col gap-3.5 px-[22px] py-5">
          <Select label="Category" value={form.category} onChange={(e) => set("category", e.target.value)}>
            {CATEGORY_OPTIONS.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </Select>
          <Field label="Description (optional)" value={form.description} onChange={(e) => set("description", e.target.value)} />
          <div className="grid grid-cols-2 gap-3">
            <Field label="Amount" type="number" step="0.01" value={form.amount} onChange={(e) => set("amount", e.target.value)} required />
            <Field label="Date" type="date" value={form.incurredAt} onChange={(e) => set("incurredAt", e.target.value)} required />
          </div>
          {error && <p className="text-[13px] font-medium text-red">{error}</p>}
        </div>
        <div className="flex justify-end gap-2.5 border-t border-border px-[22px] py-4">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={saving}>
            {saving ? "Saving…" : expense ? "Save changes" : "Add expense"}
          </Button>
        </div>
      </form>
    </div>
  );
}
