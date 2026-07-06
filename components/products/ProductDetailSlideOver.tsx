"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useToast } from "@/components/app/ToastProvider";
import { archiveProduct, deleteProduct, duplicateProduct } from "@/lib/actions/products";
import type { ProductDetail } from "@/lib/queries/products";
import { useWorkspace } from "@/components/app/CurrencyProvider";
import { EditProductModal } from "@/components/products/EditProductModal";
import { BarcodePreview } from "@/components/products/BarcodePreview";

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
}: {
  product: ProductDetail;
  categories: Option[];
  warehouses: Option[];
  suppliers: Option[];
  onClose: () => void;
}) {
  const router = useRouter();
  const flash = useToast();
  const { format: formatMoney } = useWorkspace();
  const [busy, setBusy] = useState(false);
  const [showEdit, setShowEdit] = useState(false);

  const margin = product.sell_price > 0 ? Math.round((1 - product.cost_price / product.sell_price) * 100) : 0;
  const facts = [
    { k: "Cost price", v: formatMoney(product.cost_price) },
    { k: "Selling price", v: formatMoney(product.sell_price) },
    { k: "Margin", v: `${margin}%` },
    { k: "On hand", v: String(product.qty_on_hand) },
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

  return (
    <>
      <div onClick={onClose} className="animate-fade-in fixed inset-0 z-[70] bg-[rgba(15,20,32,.4)]" />
      <div className="scroll animate-slide-over fixed inset-y-0 right-0 z-[71] w-[460px] max-w-[92vw] overflow-y-auto border-l border-border bg-surface shadow-[var(--shadow-lg)]">
        <div className="sticky top-0 z-[2] flex items-center gap-3 border-b border-border bg-surface px-[22px] py-[18px]">
          <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center overflow-hidden rounded-[11px] bg-accent-weak text-[22px]">
            {product.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={product.imageUrl} alt={product.name} className="h-full w-full object-cover" />
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
        />
      )}
    </>
  );
}
