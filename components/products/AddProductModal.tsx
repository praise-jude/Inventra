"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/app/ToastProvider";
import { createProduct } from "@/lib/actions/products";
import { Field } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";

interface Option {
  id: string;
  name: string;
}

export function AddProductModal({
  categories,
  warehouses,
  suppliers,
  onClose,
}: {
  categories: Option[];
  warehouses: Option[];
  suppliers: Option[];
  onClose: () => void;
}) {
  const router = useRouter();
  const flash = useToast();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: "",
    description: "",
    sku: "",
    categoryId: categories[0]?.id ?? "",
    unit: "each",
    costPrice: "",
    sellPrice: "",
    reorderLevel: "",
    supplierId: suppliers[0]?.id ?? "",
    warehouseId: warehouses[0]?.id ?? "",
    openingQty: "0",
  });

  function set<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!form.name || !form.sku) {
      setError("Name and SKU are required.");
      return;
    }
    setSaving(true);
    try {
      await createProduct({
        name: form.name,
        description: form.description,
        sku: form.sku,
        categoryId: form.categoryId,
        unit: form.unit,
        costPrice: parseFloat(form.costPrice) || 0,
        sellPrice: parseFloat(form.sellPrice) || 0,
        reorderLevel: parseInt(form.reorderLevel, 10) || 0,
        supplierId: form.supplierId,
        warehouseId: form.warehouseId,
        openingQty: parseInt(form.openingQty, 10) || 0,
      });
      flash("Product created");
      onClose();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create product.");
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
        className="scroll animate-scale-in w-full max-w-[600px] max-h-[88vh] overflow-y-auto rounded-2xl border border-border bg-surface shadow-[var(--shadow-lg)]"
      >
        <div className="sticky top-0 flex items-center justify-between border-b border-border bg-surface px-[22px] py-[18px]">
          <div>
            <div className="text-[16px] font-bold">New product</div>
            <div className="text-[12.5px] text-muted">Add an item to your catalog.</div>
          </div>
          <button type="button" onClick={onClose} className="h-8 w-8 rounded-[8px] border border-border bg-surface text-text">
            ✕
          </button>
        </div>
        <div className="flex flex-col gap-[15px] px-[22px] py-5">
          <div className="flex items-start gap-3.5">
            <div className="flex h-[88px] w-[88px] flex-shrink-0 flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-border bg-surface-2 text-center text-[11px] text-muted">
              <span className="text-[20px]">🖼️</span>
              Add image
            </div>
            <div className="flex-1">
              <Field label="Product name" placeholder="e.g. Organic Whole Milk 1L" value={form.name} onChange={(e) => set("name", e.target.value)} required />
              <div className="mt-3">
                <Field label="Description" placeholder="Short description" value={form.description} onChange={(e) => set("description", e.target.value)} />
              </div>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <Field label="SKU" placeholder="MLK-001" value={form.sku} onChange={(e) => set("sku", e.target.value)} required />
            <div>
              <label className="mb-1.5 block text-[12.5px] font-semibold text-text-2">Category</label>
              <select
                value={form.categoryId}
                onChange={(e) => set("categoryId", e.target.value)}
                className="h-[40px] w-full rounded-[9px] border border-border bg-surface-2 px-3 text-[13.5px] text-text"
              >
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <Field label="Unit" placeholder="each" value={form.unit} onChange={(e) => set("unit", e.target.value)} />
            <Field label="Cost price" placeholder="1.20" type="number" step="0.01" value={form.costPrice} onChange={(e) => set("costPrice", e.target.value)} />
            <Field label="Selling price" placeholder="2.49" type="number" step="0.01" value={form.sellPrice} onChange={(e) => set("sellPrice", e.target.value)} />
            <Field label="Reorder level" placeholder="120" type="number" value={form.reorderLevel} onChange={(e) => set("reorderLevel", e.target.value)} />
            <div>
              <label className="mb-1.5 block text-[12.5px] font-semibold text-text-2">Supplier</label>
              <select
                value={form.supplierId}
                onChange={(e) => set("supplierId", e.target.value)}
                className="h-[40px] w-full rounded-[9px] border border-border bg-surface-2 px-3 text-[13.5px] text-text"
              >
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-[12.5px] font-semibold text-text-2">Warehouse</label>
              <select
                value={form.warehouseId}
                onChange={(e) => set("warehouseId", e.target.value)}
                className="h-[40px] w-full rounded-[9px] border border-border bg-surface-2 px-3 text-[13.5px] text-text"
              >
                {warehouses.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name}
                  </option>
                ))}
              </select>
            </div>
            <Field label="Opening qty" placeholder="0" type="number" value={form.openingQty} onChange={(e) => set("openingQty", e.target.value)} />
          </div>
          {error && <p className="text-[13px] font-medium text-red">{error}</p>}
        </div>
        <div className="sticky bottom-0 flex justify-end gap-2.5 border-t border-border bg-surface px-[22px] py-4">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={saving}>
            {saving ? "Creating…" : "Create product"}
          </Button>
        </div>
      </form>
    </div>
  );
}
