"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import dynamic from "next/dynamic";
import Image from "next/image";
import { useToast } from "@/components/app/ToastProvider";
import { archiveProduct, deleteProduct, duplicateProduct, fetchProductDetail } from "@/lib/actions/products";
import { createAdjustment } from "@/lib/actions/inventory";
import { notifyDataChanged } from "@/lib/client-events";
import type { ProductDetail } from "@/lib/queries/products";
import { useWorkspace } from "@/components/app/CurrencyProvider";

const EditProductModal = dynamic(() => import("@/components/products/EditProductModal").then((m) => m.EditProductModal));
const BarcodePreview = dynamic(() => import("@/components/products/BarcodePreview").then((m) => m.BarcodePreview));

interface Option {
  id: string;
  name: string;
}

export function ProductDetailSlideOver({
  product,
  categories,
  warehouses,
  suppliers,
  onClose,
  onProductUpdated,
}: {
  product: ProductDetail;
  categories: Option[];
  warehouses: Option[];
  suppliers: Option[];
  onClose: () => void;
  onProductUpdated: (updated: ProductDetail) => void;
}) {
  const router = useRouter();
  const flash = useToast();
  const { format: formatMoney } = useWorkspace();
  const [busy, setBusy] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [showAdjust, setShowAdjust] = useState(false);
  const [adjustQty, setAdjustQty] = useState("");
  const [adjustReason, setAdjustReason] = useState("");
  const [adjustKind, setAdjustKind] = useState<"adjustment" | "expired">("adjustment");
  const [adjustError, setAdjustError] = useState<string | null>(null);
  const [adjustSaving, setAdjustSaving] = useState(false);

  const margin = product.sell_price > 0 ? Math.round((1 - product.cost_price / product.sell_price) * 100) : 0;
  const profitPerUnit = product.sell_price - product.cost_price;
  const productValue = product.cost_price * product.qty_on_hand;
  const facts = [
    { k: "Cost price", v: formatMoney(product.cost_price) },
    { k: "Selling price", v: formatMoney(product.sell_price) },
    { k: "Margin", v: `${margin}%` },
    { k: "Profit per unit", v: formatMoney(profitPerUnit) },
    { k: "Product value", v: formatMoney(productValue) },
    { k: "Reorder at", v: String(product.reorder_level) },
    { k: "Warehouse", v: product.warehouse ?? "—" },
    { k: "Category", v: product.category ?? "—" },
    { k: "Supplier", v: product.supplier ?? "—" },
    { k: "Expiry", v: product.expiry_date ?? "—" },
  ];

  async function handleArchive() {
    setBusy(true);
    try {
      await archiveProduct(product.id);
      onClose();
      flash("Product archived");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete() {
    if (!window.confirm(`Delete "${product.name}"? This can't be undone.`)) return;
    setBusy(true);
    try {
      await deleteProduct(product.id);
      onClose();
      flash("Product deleted");
      router.refresh();
    } catch (err) {
      flash(err instanceof Error ? err.message : "Could not delete the product.");
    } finally {
      setBusy(false);
    }
  }

  async function handleDuplicate() {
    setBusy(true);
    await duplicateProduct(product.id);
    setBusy(false);
    flash("Product duplicated");
    router.refresh();
  }

  async function handleAdjustStock(e: React.FormEvent) {
    e.preventDefault();
    setAdjustError(null);
    const qtyDelta = parseInt(adjustQty, 10);
    if (!Number.isInteger(qtyDelta) || qtyDelta === 0) {
      setAdjustError("Enter a non-zero whole number (negative to remove stock).");
      return;
    }
    if (!adjustReason.trim()) {
      setAdjustError("A reason is required for the audit trail.");
      return;
    }
    setAdjustSaving(true);
    try {
      await createAdjustment({ productId: product.id, qtyDelta, reason: adjustReason.trim(), kind: adjustKind });
      // Stock only ever changes through the stock_movements ledger (a DB
      // trigger applies qty_delta to products.qty_on_hand), so the fresh
      // read here is the single source of truth for what's now on hand.
      const fresh = await fetchProductDetail(product.id);
      if (fresh) onProductUpdated(fresh);
      flash(qtyDelta > 0 ? `Added ${qtyDelta} units` : `Removed ${Math.abs(qtyDelta)} units`);
      setShowAdjust(false);
      setAdjustQty("");
      setAdjustReason("");
      router.refresh();
      notifyDataChanged();
    } catch (err) {
      setAdjustError(err instanceof Error ? err.message : "Could not adjust stock.");
    } finally {
      setAdjustSaving(false);
    }
  }

  return (
    <>
      <div onClick={onClose} className="animate-fade-in fixed inset-0 z-[70] bg-[rgba(15,20,32,.4)]" />
      <div className="scroll animate-slide-over fixed inset-y-0 right-0 z-[71] w-[460px] max-w-[92vw] overflow-y-auto border-l border-border bg-surface shadow-[var(--shadow-lg)]">
        <div className="sticky top-0 z-[2] flex items-center gap-3 border-b border-border bg-surface px-[22px] py-[18px]">
          <div className="relative flex h-11 w-11 flex-shrink-0 items-center justify-center overflow-hidden rounded-[11px] bg-accent-weak text-[22px]">
            {product.imageUrl ? (
              <Image src={product.imageUrl} alt={product.name} fill sizes="44px" className="object-cover" />
            ) : (
              product.emoji || "📦"
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-[16px] font-bold tracking-tight">{product.name}</div>
            <div className="font-mono text-[12px] text-muted">
              {product.sku} · {product.brand ?? "—"}
            </div>
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
            <button
              onClick={handleDuplicate}
              disabled={busy}
              className="h-[38px] rounded-[9px] border border-border bg-surface px-3.5 text-[13px] font-semibold text-text"
            >
              Duplicate
            </button>
            <button
              onClick={handleArchive}
              disabled={busy}
              className="h-[38px] rounded-[9px] border border-border bg-surface px-3.5 text-[13px] font-semibold text-text"
            >
              Archive
            </button>
            <button
              onClick={handleDelete}
              disabled={busy}
              className="h-[38px] rounded-[9px] border border-border bg-surface px-3.5 text-[13px] font-semibold text-red"
            >
              Delete
            </button>
          </div>

          <div className="mb-5 flex justify-center rounded-[11px] border border-border bg-white p-3">
            {product.barcode || product.sku ? (
              <BarcodePreview value={product.barcode || product.sku} />
            ) : (
              <span className="text-[12.5px] text-muted">No barcode set</span>
            )}
          </div>

          <div className="mb-5 rounded-xl border border-border bg-surface-2 p-[13px_15px]">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.04em] text-muted">On hand</div>
                <div className="mt-0.5 font-mono text-[19px] font-bold">{product.qty_on_hand}</div>
              </div>
              <button
                type="button"
                onClick={() => setShowAdjust((v) => !v)}
                className="h-8 rounded-[8px] border border-border bg-surface px-3 text-[12.5px] font-semibold text-text hover:bg-hover"
              >
                Adjust stock
              </button>
            </div>
            {showAdjust && (
              <form onSubmit={handleAdjustStock} className="mt-3 flex flex-col gap-2 border-t border-border pt-3">
                <div className="flex gap-2">
                  <input
                    type="number"
                    value={adjustQty}
                    onChange={(e) => setAdjustQty(e.target.value)}
                    placeholder="e.g. -5 or 20"
                    className="h-9 w-24 rounded-[7px] border border-border bg-surface px-2 text-[13px] text-text outline-none"
                  />
                  <select
                    value={adjustKind}
                    onChange={(e) => setAdjustKind(e.target.value as "adjustment" | "expired")}
                    className="h-9 flex-1 rounded-[7px] border border-border bg-surface px-2 text-[13px] text-text"
                  >
                    <option value="adjustment">Adjustment (recount, damage, loss)</option>
                    <option value="expired">Expired write-off</option>
                  </select>
                </div>
                <input
                  value={adjustReason}
                  onChange={(e) => setAdjustReason(e.target.value)}
                  placeholder="Reason (required for the audit trail)"
                  className="h-9 rounded-[7px] border border-border bg-surface px-2.5 text-[13px] text-text outline-none"
                />
                {adjustError && <p className="text-[12.5px] font-medium text-red">{adjustError}</p>}
                <button
                  type="submit"
                  disabled={adjustSaving}
                  className="h-9 rounded-[7px] bg-accent text-[12.5px] font-semibold text-white disabled:opacity-60"
                >
                  {adjustSaving ? "Saving…" : "Save adjustment"}
                </button>
              </form>
            )}
          </div>

          <div className="mb-5 grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-border bg-border">
            {facts.map((f) => (
              <div key={f.k} className="bg-surface p-[11px_13px]">
                <div className="text-[11px] font-semibold uppercase tracking-[0.04em] text-muted">{f.k}</div>
                <div className="mt-0.5 font-mono text-[13.5px] font-semibold">{f.v}</div>
              </div>
            ))}
          </div>

          <div className="mb-2.5 text-[14px] font-bold">Variants</div>
          <div className="flex flex-col gap-2">
            {product.variants.length === 0 && (
              <div className="rounded-[10px] border border-border bg-surface-2 px-3 py-2.5 text-[13px] text-muted">
                No variants — single SKU
              </div>
            )}
            {product.variants.map((v) => (
              <div key={v.id} className="flex items-center gap-[11px] rounded-[10px] border border-border bg-surface-2 px-3 py-2.5">
                <span className="flex h-[26px] w-[26px] items-center justify-center rounded-[7px] bg-accent-weak text-[12px]">📦</span>
                <div className="flex-1">
                  <div className="text-[13px] font-semibold">{v.name}</div>
                  <div className="font-mono text-[11px] text-muted">{product.sku}-{v.sku_suffix}</div>
                </div>
                <div className="text-right">
                  <div className="font-mono text-[13px] font-bold">{v.qty_on_hand}</div>
                  <div className="text-[11px] text-muted">in stock</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
      {showEdit && (
        <EditProductModal
          product={product}
          categories={categories}
          warehouses={warehouses}
          suppliers={suppliers}
          onClose={() => setShowEdit(false)}
          onSaved={onProductUpdated}
        />
      )}
    </>
  );
}
