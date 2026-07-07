"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/app/ToastProvider";
import { createProduct } from "@/lib/actions/products";
import { ProductFormFields, type ProductFormState } from "@/components/products/ProductFormFields";
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
  const [fieldErrors, setFieldErrors] = useState<{ name?: string; sku?: string }>({});
  const [categoryOptions, setCategoryOptions] = useState(categories);
  const [supplierOptions, setSupplierOptions] = useState(suppliers);
  const [form, setForm] = useState<ProductFormState>({
    name: "",
    description: "",
    sku: "",
    barcode: "",
    categoryId: categories[0]?.id ?? "",
    unit: "each",
    brand: "",
    costPrice: "",
    sellPrice: "",
    reorderLevel: "",
    supplierId: suppliers[0]?.id ?? "",
    warehouseId: warehouses[0]?.id ?? "",
    expiryDate: "",
    imageUrl: "",
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
      await createProduct({
        name: form.name,
        description: form.description,
        sku: form.sku,
        barcode: form.barcode,
        categoryId: form.categoryId,
        unit: form.unit,
        costPrice: parseFloat(form.costPrice) || 0,
        sellPrice: parseFloat(form.sellPrice) || 0,
        reorderLevel: parseInt(form.reorderLevel, 10) || 0,
        supplierId: form.supplierId,
        warehouseId: form.warehouseId,
        openingQty: parseInt(form.openingQty, 10) || 0,
        imageUrl: form.imageUrl,
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
        <div className="px-[22px] py-5">
          <ProductFormFields
            form={form}
            set={set}
            categories={categoryOptions}
            suppliers={supplierOptions}
            warehouses={warehouses}
            onCategoryCreated={(opt) => setCategoryOptions((c) => [...c, opt])}
            onSupplierCreated={(opt) => setSupplierOptions((s) => [...s, opt])}
            showOpeningQty
            fieldErrors={fieldErrors}
          />
          {error && <p className="mt-3 text-[13px] font-medium text-red">{error}</p>}
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
