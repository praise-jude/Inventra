"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { useToast } from "@/components/app/ToastProvider";
import { useWorkspace } from "@/components/app/CurrencyProvider";
import { recordSale } from "@/lib/actions/sales";
import type { ProductListRow } from "@/lib/queries/products";
import { Field } from "@/components/ui/Field";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { ReceiptModal } from "@/components/sales/ReceiptModal";

const BarcodeScannerModal = dynamic(() =>
  import("@/components/products/BarcodeScannerModal").then((m) => m.BarcodeScannerModal),
);

const PAYMENT_OPTIONS = [
  { value: "cash", label: "Cash" },
  { value: "card", label: "Card" },
  { value: "bank_transfer", label: "Bank Transfer" },
  { value: "mobile_money", label: "Mobile Money" },
];

interface CartLine {
  productId: string;
  name: string;
  price: number;
  availableQty: number;
  qty: number;
  discountPct: number;
}

export function NewSaleForm({
  products,
  warehouses,
  taxRate,
}: {
  products: ProductListRow[];
  warehouses: { id: string; name: string }[];
  taxRate: number;
}) {
  const router = useRouter();
  const flash = useToast();
  const { format: formatMoney } = useWorkspace();

  const [warehouseId, setWarehouseId] = useState("");

  const [productQuery, setProductQuery] = useState("");
  const [showScanner, setShowScanner] = useState(false);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [receiptSaleId, setReceiptSaleId] = useState<string | null>(null);

  const matchingProducts = useMemo(() => {
    const q = productQuery.trim().toLowerCase();
    if (!q) return [];
    return products.filter((p) => p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q)).slice(0, 8);
  }, [products, productQuery]);

  function addProduct(product: ProductListRow) {
    setProductQuery("");
    setCart((c) => {
      const existing = c.find((l) => l.productId === product.id);
      if (existing) {
        return c.map((l) => (l.productId === product.id ? { ...l, qty: Math.min(l.qty + 1, product.qty) } : l));
      }
      return [...c, { productId: product.id, name: product.name, price: product.price, availableQty: product.qty, qty: 1, discountPct: 0 }];
    });
  }

  function updateLine(productId: string, patch: Partial<CartLine>) {
    setCart((c) => c.map((l) => (l.productId === productId ? { ...l, ...patch } : l)));
  }

  function removeLine(productId: string) {
    setCart((c) => c.filter((l) => l.productId !== productId));
  }

  function handleProductSearchKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key !== "Enter") return;
    const code = productQuery.trim();
    if (!code) return;
    const match = products.find((p) => p.sku === code || p.barcode === code);
    if (match) addProduct(match);
  }

  function handleScanDetected(code: string) {
    setShowScanner(false);
    const match = products.find((p) => p.sku === code || p.barcode === code);
    if (match) {
      addProduct(match);
    } else {
      setError(`No product found for code "${code}"`);
    }
  }

  const totals = useMemo(() => {
    let subtotal = 0;
    let discount = 0;
    for (const l of cart) {
      const lineSubtotal = l.price * l.qty;
      subtotal += lineSubtotal;
      discount += lineSubtotal * (l.discountPct / 100);
    }
    const taxable = subtotal - discount;
    const tax = taxable * (taxRate / 100);
    return { subtotal, discount, tax, total: taxable + tax };
  }, [cart, taxRate]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (cart.length === 0) {
      setError("Add at least one product.");
      return;
    }
    setSaving(true);
    try {
      const saleId = await recordSale({
        warehouseId: warehouseId || undefined,
        items: cart.map((l) => ({ productId: l.productId, qty: l.qty, discountPct: l.discountPct })),
        paymentMethod,
        notes,
      });
      flash("Sale recorded");
      router.refresh();
      setReceiptSaleId(saleId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not record the sale.");
    } finally {
      setSaving(false);
    }
  }

  function closeReceipt() {
    const saleId = receiptSaleId;
    setReceiptSaleId(null);
    if (saleId) router.push(`/sales?open=${saleId}`);
  }

  return (
    <>
    <form onSubmit={handleSubmit} className="animate-fade-up flex flex-col gap-4.5">
      <div className="rounded-2xl border border-border bg-surface p-5 shadow-[var(--shadow-sm)]">
        <div className="mb-3.5 text-[15px] font-bold">Items</div>
        <div className="relative flex gap-2">
          <input
            value={productQuery}
            onChange={(e) => setProductQuery(e.target.value)}
            onKeyDown={handleProductSearchKeyDown}
            placeholder="Search products to add by name, SKU, or scan a barcode…"
            className="h-[42px] flex-1 rounded-[9px] border border-border bg-surface px-[13px] text-[14px] text-text outline-none focus:border-accent"
          />
          <button
            type="button"
            onClick={() => setShowScanner(true)}
            className="h-[42px] rounded-[9px] border border-border bg-surface px-3.5 text-[13px] font-semibold text-text hover:bg-hover"
          >
            📷 Scan
          </button>
          {matchingProducts.length > 0 && (
            <div className="absolute z-10 mt-1 w-full overflow-hidden rounded-[9px] border border-border bg-surface shadow-[var(--shadow-lg)]">
              {matchingProducts.map((p) => (
                <button
                  type="button"
                  key={p.id}
                  onClick={() => addProduct(p)}
                  className="flex w-full items-center justify-between px-3.5 py-2.5 text-left text-[13px] hover:bg-hover"
                  disabled={p.qty <= 0}
                >
                  <span>
                    {p.emoji || "📦"} {p.name} <span className="text-muted">({p.sku})</span>
                  </span>
                  <span className="font-mono text-[12px] text-muted">{p.qty <= 0 ? "Out of stock" : `${p.qty} in stock`}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {cart.length > 0 && (
          <div className="mt-3.5 overflow-hidden rounded-[10px] border border-border">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-surface-2">
                  <th className="px-3 py-2 text-left text-[11px] font-bold uppercase tracking-[0.04em] text-muted">Product</th>
                  <th className="px-3 py-2 text-right text-[11px] font-bold uppercase tracking-[0.04em] text-muted">Qty</th>
                  <th className="px-3 py-2 text-right text-[11px] font-bold uppercase tracking-[0.04em] text-muted">Discount %</th>
                  <th className="px-3 py-2 text-right text-[11px] font-bold uppercase tracking-[0.04em] text-muted">Line total</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody>
                {cart.map((l) => {
                  const lineTotal = l.price * l.qty * (1 - l.discountPct / 100);
                  return (
                    <tr key={l.productId} className="border-t border-border-2">
                      <td className="px-3 py-2 text-[13px] font-semibold">{l.name}</td>
                      <td className="px-3 py-2 text-right">
                        <input
                          type="number"
                          min={1}
                          max={l.availableQty}
                          value={l.qty}
                          onChange={(e) => updateLine(l.productId, { qty: Math.max(1, Math.min(Number(e.target.value) || 1, l.availableQty)) })}
                          className="h-8 w-16 rounded-[7px] border border-border bg-surface px-2 text-right text-[13px]"
                        />
                      </td>
                      <td className="px-3 py-2 text-right">
                        <input
                          type="number"
                          min={0}
                          max={100}
                          value={l.discountPct}
                          onChange={(e) => updateLine(l.productId, { discountPct: Math.max(0, Math.min(Number(e.target.value) || 0, 100)) })}
                          className="h-8 w-16 rounded-[7px] border border-border bg-surface px-2 text-right text-[13px]"
                        />
                      </td>
                      <td className="px-3 py-2 text-right font-mono text-[13px] font-bold">{formatMoney(lineTotal)}</td>
                      <td className="px-3 py-2 text-right">
                        <button type="button" onClick={() => removeLine(l.productId)} className="text-[12px] font-semibold text-red">
                          Remove
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {cart.length === 0 && (
          <div
            className="mt-3.5 rounded-[10px] border px-3 py-6 text-center text-[13px] text-muted"
            style={error === "Add at least one product." ? { borderColor: "var(--red)", background: "var(--red-weak)" } : { borderColor: "var(--border)", background: "var(--surface-2)" }}
          >
            Search above to add products to this sale.
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-border bg-surface p-5 shadow-[var(--shadow-sm)]">
        <div className="mb-3.5 grid grid-cols-2 gap-3">
          {warehouses.length > 0 && (
            <Select label="Branch (optional)" value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)}>
              <option value="">Unassigned</option>
              {warehouses.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                </option>
              ))}
            </Select>
          )}
          <Select label="Payment method" value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}>
            {PAYMENT_OPTIONS.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </Select>
          <Field label="Notes (optional)" value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>
        <div className="flex flex-col gap-1.5 border-t border-border pt-3.5 text-[13px]">
          <div className="flex justify-between text-text-2">
            <span>Subtotal</span>
            <span className="font-mono">{formatMoney(totals.subtotal)}</span>
          </div>
          <div className="flex justify-between text-text-2">
            <span>Discount</span>
            <span className="font-mono">-{formatMoney(totals.discount)}</span>
          </div>
          <div className="flex justify-between text-text-2">
            <span>Tax ({taxRate}%)</span>
            <span className="font-mono">{formatMoney(totals.tax)}</span>
          </div>
          <div className="flex justify-between text-[16px] font-bold">
            <span>Total</span>
            <span className="font-mono">{formatMoney(totals.total)}</span>
          </div>
        </div>
        {error && <p className="mt-3 text-[13px] font-medium text-red">{error}</p>}
        <div className="mt-4 flex justify-end gap-2.5">
          <Button type="submit" disabled={saving || cart.length === 0}>
            {saving ? "Recording…" : "Record sale"}
          </Button>
        </div>
      </div>
    </form>
    {showScanner && <BarcodeScannerModal onDetected={handleScanDetected} onClose={() => setShowScanner(false)} />}
    {receiptSaleId && <ReceiptModal saleId={receiptSaleId} onClose={closeReceipt} />}
    </>
  );
}
