"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/app/ToastProvider";
import { useWorkspace } from "@/components/app/CurrencyProvider";
import { createSupplyRecord } from "@/lib/actions/supply-records";
import type { ProductListRow } from "@/lib/queries/products";
import { Field } from "@/components/ui/Field";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";

interface SupplyLine {
  productId: string;
  name: string;
  quantity: number;
  unitCost: number;
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export function NewSupplyRecordForm({
  products,
  warehouses,
  suppliers,
}: {
  products: ProductListRow[];
  warehouses: { id: string; name: string }[];
  suppliers: { id: string; name: string; phone: string | null; email: string | null }[];
}) {
  const router = useRouter();
  const flash = useToast();
  const { format: formatMoney } = useWorkspace();

  const [supplierId, setSupplierId] = useState("");
  const [supplierName, setSupplierName] = useState("");
  const [supplierPhone, setSupplierPhone] = useState("");
  const [supplierEmail, setSupplierEmail] = useState("");
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [warehouseId, setWarehouseId] = useState(warehouses[0]?.id ?? "");
  const [dateSupplied, setDateSupplied] = useState(todayIso());
  const [notes, setNotes] = useState("");

  const [productQuery, setProductQuery] = useState("");
  const [lines, setLines] = useState<SupplyLine[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const matchingProducts = useMemo(() => {
    const q = productQuery.trim().toLowerCase();
    if (!q) return [];
    return products.filter((p) => p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q)).slice(0, 8);
  }, [products, productQuery]);

  function addProduct(product: ProductListRow) {
    setProductQuery("");
    setLines((ls) => {
      if (ls.some((l) => l.productId === product.id)) return ls;
      return [...ls, { productId: product.id, name: product.name, quantity: 1, unitCost: product.price }];
    });
  }

  function updateLine(productId: string, patch: Partial<SupplyLine>) {
    setLines((ls) => ls.map((l) => (l.productId === productId ? { ...l, ...patch } : l)));
  }

  function removeLine(productId: string) {
    setLines((ls) => ls.filter((l) => l.productId !== productId));
  }

  function selectSupplier(id: string) {
    setSupplierId(id);
    const s = suppliers.find((s) => s.id === id);
    if (s) {
      setSupplierName(s.name);
      setSupplierPhone(s.phone ?? "");
      setSupplierEmail(s.email ?? "");
    }
  }

  const totals = useMemo(() => {
    const totalQuantity = lines.reduce((sum, l) => sum + l.quantity, 0);
    const totalAmount = lines.reduce((sum, l) => sum + l.quantity * l.unitCost, 0);
    return { totalQuantity, totalAmount };
  }, [lines]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!supplierName.trim()) {
      setError("Supplier name is required.");
      return;
    }
    if (!warehouseId) {
      setError("Pick a branch.");
      return;
    }
    if (lines.length === 0) {
      setError("Add at least one product.");
      return;
    }
    setSaving(true);
    try {
      const id = await createSupplyRecord({
        supplierId: supplierId || undefined,
        supplierName,
        supplierPhone: supplierPhone || undefined,
        supplierEmail: supplierEmail || undefined,
        invoiceNumber: invoiceNumber || undefined,
        warehouseId,
        dateSupplied,
        notes,
        items: lines.map((l) => ({ productId: l.productId, quantity: l.quantity, unitCost: l.unitCost })),
      });
      flash("Supply record created");
      router.push(`/inventory/supply-records/${id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create the supply record.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="animate-fade-up flex flex-col gap-4.5">
      <div className="rounded-2xl border border-border bg-surface p-5 shadow-[var(--shadow-sm)]">
        <div className="mb-3.5 text-[15px] font-bold">Supplier</div>
        <div className="grid grid-cols-2 gap-3">
          {suppliers.length > 0 && (
            <Select label="Existing supplier (optional)" value={supplierId} onChange={(e) => selectSupplier(e.target.value)}>
              <option value="">— One-off / not in directory —</option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>
          )}
          <Field label="Supplier name" value={supplierName} onChange={(e) => setSupplierName(e.target.value)} required />
          <Field label="Phone (optional)" value={supplierPhone} onChange={(e) => setSupplierPhone(e.target.value)} />
          <Field label="Email (optional)" type="email" value={supplierEmail} onChange={(e) => setSupplierEmail(e.target.value)} />
          <Field label="Invoice number (optional)" value={invoiceNumber} onChange={(e) => setInvoiceNumber(e.target.value)} />
          <Field label="Date supplied" type="date" value={dateSupplied} onChange={(e) => setDateSupplied(e.target.value)} required />
          <Select label="Branch" value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)}>
            {warehouses.length === 0 && <option value="">No branches yet</option>}
            {warehouses.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name}
              </option>
            ))}
          </Select>
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-surface p-5 shadow-[var(--shadow-sm)]">
        <div className="mb-3.5 text-[15px] font-bold">Products supplied</div>
        <div className="relative">
          <input
            value={productQuery}
            onChange={(e) => setProductQuery(e.target.value)}
            placeholder="Search products to add by name or SKU…"
            className="h-[42px] w-full rounded-[9px] border border-border bg-surface px-[13px] text-[14px] text-text outline-none focus:border-accent"
          />
          {matchingProducts.length > 0 && (
            <div className="absolute z-10 mt-1 w-full overflow-hidden rounded-[9px] border border-border bg-surface shadow-[var(--shadow-lg)]">
              {matchingProducts.map((p) => (
                <button
                  type="button"
                  key={p.id}
                  onClick={() => addProduct(p)}
                  className="flex w-full items-center justify-between px-3.5 py-2.5 text-left text-[13px] hover:bg-hover"
                >
                  <span>
                    {p.emoji || "📦"} {p.name} <span className="text-muted">({p.sku})</span>
                  </span>
                  <span className="font-mono text-[12px] text-muted">{p.qty} in stock</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {lines.length > 0 && (
          <div className="mt-3.5 overflow-hidden rounded-[10px] border border-border">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-surface-2">
                  <th className="px-3 py-2 text-left text-[11px] font-bold uppercase tracking-[0.04em] text-muted">Product</th>
                  <th className="px-3 py-2 text-right text-[11px] font-bold uppercase tracking-[0.04em] text-muted">Quantity</th>
                  <th className="px-3 py-2 text-right text-[11px] font-bold uppercase tracking-[0.04em] text-muted">Unit cost</th>
                  <th className="px-3 py-2 text-right text-[11px] font-bold uppercase tracking-[0.04em] text-muted">Line total</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody>
                {lines.map((l) => (
                  <tr key={l.productId} className="border-t border-border-2">
                    <td className="px-3 py-2 text-[13px] font-semibold">{l.name}</td>
                    <td className="px-3 py-2 text-right">
                      <input
                        type="number"
                        min={1}
                        value={l.quantity}
                        onChange={(e) => updateLine(l.productId, { quantity: Math.max(1, Number(e.target.value) || 1) })}
                        className="h-8 w-20 rounded-[7px] border border-border bg-surface px-2 text-right text-[13px]"
                      />
                    </td>
                    <td className="px-3 py-2 text-right">
                      <input
                        type="number"
                        min={0}
                        step="0.01"
                        value={l.unitCost}
                        onChange={(e) => updateLine(l.productId, { unitCost: Math.max(0, Number(e.target.value) || 0) })}
                        className="h-8 w-24 rounded-[7px] border border-border bg-surface px-2 text-right text-[13px]"
                      />
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-[13px] font-bold">{formatMoney(l.quantity * l.unitCost)}</td>
                    <td className="px-3 py-2 text-right">
                      <button type="button" onClick={() => removeLine(l.productId)} className="text-[12px] font-semibold text-red">
                        Remove
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {lines.length === 0 && (
          <div className="mt-3.5 rounded-[10px] border border-border bg-surface-2 px-3 py-6 text-center text-[13px] text-muted">
            Search above to add products to this supply.
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-border bg-surface p-5 shadow-[var(--shadow-sm)]">
        <div className="mb-3.5">
          <Field label="Notes (optional)" value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>
        <div className="flex flex-col gap-1.5 border-t border-border pt-3.5 text-[13px]">
          <div className="flex justify-between text-text-2">
            <span>Total quantity</span>
            <span className="font-mono">{totals.totalQuantity}</span>
          </div>
          <div className="flex justify-between text-[16px] font-bold">
            <span>Total supply amount</span>
            <span className="font-mono">{formatMoney(totals.totalAmount)}</span>
          </div>
        </div>
        {error && <p className="mt-3 text-[13px] font-medium text-red">{error}</p>}
        <div className="mt-4 flex justify-end gap-2.5">
          <Button type="submit" disabled={saving || lines.length === 0}>
            {saving ? "Saving…" : "Save supply record"}
          </Button>
        </div>
      </div>
    </form>
  );
}
