"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/app/ToastProvider";
import { useWorkspace } from "@/components/app/CurrencyProvider";
import { createInvoice } from "@/lib/actions/invoices";
import type { InvoiceProductOption } from "@/lib/queries/invoices";
import { Field } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";

interface ItemDraft {
  key: number;
  productId?: string;
  description: string;
  quantity: number;
  unitPrice: number;
}

let nextKey = 0;

export function InvoiceModal({ products, onClose }: { products: InvoiceProductOption[]; onClose: () => void }) {
  const router = useRouter();
  const flash = useToast();
  const { format: formatMoney } = useWorkspace();

  const [customerName, setCustomerName] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [issueDate, setIssueDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [dueDate, setDueDate] = useState("");
  const [discountAmount, setDiscountAmount] = useState("0");
  const [taxAmount, setTaxAmount] = useState("0");
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<ItemDraft[]>([{ key: nextKey++, description: "", quantity: 1, unitPrice: 0 }]);
  const [productQuery, setProductQuery] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const matchingProducts = useMemo(() => {
    const q = productQuery.trim().toLowerCase();
    if (!q) return [];
    return products.filter((p) => p.name.toLowerCase().includes(q)).slice(0, 8);
  }, [products, productQuery]);

  function addBlankRow() {
    setItems((rows) => [...rows, { key: nextKey++, description: "", quantity: 1, unitPrice: 0 }]);
  }

  function addProductRow(product: InvoiceProductOption) {
    setProductQuery("");
    setItems((rows) => {
      const blank = rows.find((r) => !r.description && !r.productId);
      const row: ItemDraft = { key: blank?.key ?? nextKey++, productId: product.id, description: product.name, quantity: 1, unitPrice: product.sellPrice };
      if (blank) return rows.map((r) => (r.key === blank.key ? row : r));
      return [...rows, row];
    });
  }

  function updateRow(key: number, patch: Partial<ItemDraft>) {
    setItems((rows) => rows.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }

  function removeRow(key: number) {
    setItems((rows) => (rows.length > 1 ? rows.filter((r) => r.key !== key) : rows));
  }

  const subtotal = items.reduce((sum, i) => sum + i.quantity * i.unitPrice, 0);
  const total = subtotal - (parseFloat(discountAmount) || 0) + (parseFloat(taxAmount) || 0);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const validItems = items.filter((i) => i.description.trim() && i.quantity > 0);
    if (validItems.length === 0) {
      setError("Add at least one line item.");
      return;
    }
    setSaving(true);
    try {
      await createInvoice({
        customerName,
        customerEmail: customerEmail || undefined,
        customerPhone: customerPhone || undefined,
        issueDate,
        dueDate: dueDate || undefined,
        discountAmount: parseFloat(discountAmount) || 0,
        taxAmount: parseFloat(taxAmount) || 0,
        notes: notes || undefined,
        items: validItems.map((i) => ({ productId: i.productId, description: i.description, quantity: i.quantity, unitPrice: i.unitPrice })),
      });
      flash("Invoice created");
      onClose();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create the invoice.");
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
        className="scroll animate-scale-in flex max-h-[90vh] w-full max-w-[640px] flex-col overflow-y-auto rounded-2xl border border-border bg-surface shadow-[var(--shadow-lg)]"
      >
        <div className="sticky top-0 z-[2] flex items-center justify-between border-b border-border bg-surface px-[22px] py-[18px]">
          <div className="text-[16px] font-bold">New invoice</div>
          <button type="button" onClick={onClose} className="h-8 w-8 rounded-[8px] border border-border bg-surface text-text">
            ✕
          </button>
        </div>
        <div className="flex flex-col gap-4.5 px-[22px] py-5">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Customer name" value={customerName} onChange={(e) => setCustomerName(e.target.value)} required />
            <Field label="Email" type="email" value={customerEmail} onChange={(e) => setCustomerEmail(e.target.value)} />
            <Field label="Phone number" value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} />
            <Field label="Issue date" type="date" value={issueDate} onChange={(e) => setIssueDate(e.target.value)} required />
            <Field label="Due date (optional)" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <div className="text-[13px] font-bold">Line items</div>
              <button type="button" onClick={addBlankRow} className="text-[12px] font-semibold text-accent-text">
                + Add row
              </button>
            </div>
            <div className="relative mb-2.5">
              <input
                value={productQuery}
                onChange={(e) => setProductQuery(e.target.value)}
                placeholder="Search a product to add (optional)…"
                className="h-9 w-full rounded-[8px] border border-border bg-surface px-3 text-[13px] text-text outline-none focus:border-accent"
              />
              {matchingProducts.length > 0 && (
                <div className="absolute z-10 mt-1 w-full overflow-hidden rounded-[9px] border border-border bg-surface shadow-[var(--shadow-lg)]">
                  {matchingProducts.map((p) => (
                    <button
                      type="button"
                      key={p.id}
                      onClick={() => addProductRow(p)}
                      className="flex w-full items-center justify-between px-3.5 py-2 text-left text-[13px] hover:bg-hover"
                    >
                      <span>{p.name}</span>
                      <span className="font-mono text-[12px] text-muted">{formatMoney(p.sellPrice)}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="flex flex-col gap-2">
              {items.map((row) => (
                <div key={row.key} className="grid items-center gap-2" style={{ gridTemplateColumns: "1fr 60px 90px 90px 24px" }}>
                  <input
                    value={row.description}
                    onChange={(e) => updateRow(row.key, { description: e.target.value })}
                    placeholder="Description"
                    className="h-9 rounded-[8px] border border-border bg-surface px-2.5 text-[13px] text-text outline-none focus:border-accent"
                  />
                  <input
                    type="number"
                    min={0}
                    step="1"
                    value={row.quantity}
                    onChange={(e) => updateRow(row.key, { quantity: Number(e.target.value) || 0 })}
                    className="h-9 rounded-[8px] border border-border bg-surface px-2 text-right text-[13px] outline-none focus:border-accent"
                  />
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    value={row.unitPrice}
                    onChange={(e) => updateRow(row.key, { unitPrice: Number(e.target.value) || 0 })}
                    className="h-9 rounded-[8px] border border-border bg-surface px-2 text-right text-[13px] outline-none focus:border-accent"
                  />
                  <div className="text-right font-mono text-[12.5px] font-semibold">{formatMoney(row.quantity * row.unitPrice)}</div>
                  <button
                    type="button"
                    onClick={() => removeRow(row.key)}
                    className="h-6 w-6 rounded-[6px] text-[13px] text-muted hover:bg-hover hover:text-red"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Discount amount" type="number" step="0.01" min={0} value={discountAmount} onChange={(e) => setDiscountAmount(e.target.value)} />
            <Field label="Tax amount" type="number" step="0.01" min={0} value={taxAmount} onChange={(e) => setTaxAmount(e.target.value)} />
          </div>
          <Field label="Notes (optional)" value={notes} onChange={(e) => setNotes(e.target.value)} />

          <div className="flex flex-col gap-1.5 rounded-[10px] border border-border bg-surface-2 p-3 text-[13px]">
            <div className="flex justify-between text-text-2">
              <span>Subtotal</span>
              <span className="font-mono">{formatMoney(subtotal)}</span>
            </div>
            <div className="flex justify-between text-[15px] font-bold">
              <span>Total</span>
              <span className="font-mono">{formatMoney(total)}</span>
            </div>
          </div>

          {error && <p className="text-[13px] font-medium text-red">{error}</p>}
        </div>
        <div className="sticky bottom-0 flex justify-end gap-2.5 border-t border-border bg-surface px-[22px] py-4">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={saving}>
            {saving ? "Creating…" : "Create invoice"}
          </Button>
        </div>
      </form>
    </div>
  );
}
