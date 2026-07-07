"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/app/ToastProvider";
import { updateProduct } from "@/lib/actions/products";
import { notifyDataChanged } from "@/lib/client-events";
import type { ProductDetail } from "@/lib/queries/products";
import { ProductFormFields, type ProductFormState } from "@/components/products/ProductFormFields";
import { Button } from "@/components/ui/Button";

interface Option {
  id: string;
  name: string;
}

export function EditProductModal({
  product,
  categories,
  warehouses,
  suppliers,
  onClose,
  onSaved,
}: {
  product: ProductDetail;
  categories: Option[];
  warehouses: Option[];
  suppliers: Option[];
  onClose: () => void;
  onSaved: (updated: ProductDetail) => void;
}) {
  const router = useRouter();
  const flash = useToast();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{ name?: string; sku?: string }>({});
  const [categoryOptions, setCategoryOptions] = useState(categories);
  const [supplierOptions, setSupplierOptions] = useState(suppliers);
  const [form, setForm] = useState<ProductFormState>({
    name: product.name,
    description: product.description ?? "",
    sku: product.sku,
    barcode: product.barcode ?? "",
    categoryId: product.categoryId ?? "",
    unit: product.unit,
    brand: product.brand ?? "",
    costPrice: String(product.cost_price),
    sellPrice: String(product.sell_price),
    reorderLevel: String(product.reorder_level),
    supplierId: product.supplierId ?? "",
    warehouseId: product.warehouseId ?? "",
    expiryDate: product.expiry_date ?? "",
    imageUrl: product.imageUrl ?? "",
    openingQty: "0",
  });

  function set<K extends keyof ProductFormState>(key: K, value: ProductFormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
    if (key === "name" || key === "sku") setFieldErrors((fe) => ({ ...fe, [key]: undefined }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const errs: { name?: string; sku?: string } = {};
    if (!form.name.trim()) errs.name = "Product name is required.";
    if (!form.sku.trim()) errs.sku = "SKU is required.";
    setFieldErrors(errs);
    if (Object.keys(errs).length > 0) return;
    setSaving(true);
    try {
      const updated = await updateProduct(product.id, {
        name: form.name,
        description: form.description,
        sku: form.sku,
        barcode: form.barcode,
        categoryId: form.categoryId,
        unit: form.unit,
        brand: form.brand,
        costPrice: parseFloat(form.costPrice) || 0,
        sellPrice: parseFloat(form.sellPrice) || 0,
        reorderLevel: parseInt(form.reorderLevel, 10) || 0,
        supplierId: form.supplierId,
        warehouseId: form.warehouseId,
        expiryDate: form.expiryDate,
        imageUrl: form.imageUrl,
      });
      flash("Product updated");
      // Hand the freshly-persisted row back up before closing — the detail
      // panel this modal opened from holds its own copy of the product in
      // React state, and router.refresh() only refreshes server-rendered
      // props, not that client-side snapshot.
      onSaved(updated);
      onClose();
      router.refresh();
      notifyDataChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update product.");
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
            <div className="text-[16px] font-bold">Edit product</div>
            <div className="text-[12.5px] text-muted">Update this item&apos;s details.</div>
          </div>
          <button type="button" onClick={onClose} className="h-8 w-8 rounded-[8px] border border-border bg-surface text-text">
            ✕
          </button>
        </div>
        <div className="px-[22px] py-5">
          <ProductFormFields
            form={form}
            set={set}
            categories={categoryOptions}
            suppliers={supplierOptions}
            warehouses={warehouses}
            onCategoryCreated={(opt) => setCategoryOptions((c) => [...c, opt])}
            onSupplierCreated={(opt) => setSupplierOptions((s) => [...s, opt])}
            showOpeningQty={false}
            fieldErrors={fieldErrors}
          />
          {error && <p className="mt-3 text-[13px] font-medium text-red">{error}</p>}
        </div>
        <div className="sticky bottom-0 flex justify-end gap-2.5 border-t border-border bg-surface px-[22px] py-4">
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
