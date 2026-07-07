"use client";

import { useState } from "react";
import Image from "next/image";
import { createCategory } from "@/lib/actions/categories";
import { createSupplier } from "@/lib/actions/suppliers";
import { uploadProductImage } from "@/lib/actions/products";
import { generateEan13 } from "@/lib/barcode";
import { Field } from "@/components/ui/Field";
import { BarcodePreview } from "@/components/products/BarcodePreview";

interface Option {
  id: string;
  name: string;
}

export interface ProductFormState {
  name: string;
  description: string;
  sku: string;
  barcode: string;
  categoryId: string;
  unit: string;
  brand: string;
  costPrice: string;
  sellPrice: string;
  reorderLevel: string;
  supplierId: string;
  warehouseId: string;
  expiryDate: string;
  imageUrl: string;
  openingQty: string;
}

const ADD_NEW = "__add_new__";

export function ProductFormFields({
  form,
  set,
  categories,
  suppliers,
  warehouses,
  onCategoryCreated,
  onSupplierCreated,
  showOpeningQty,
  fieldErrors,
}: {
  form: ProductFormState;
  set: <K extends keyof ProductFormState>(key: K, value: ProductFormState[K]) => void;
  categories: Option[];
  suppliers: Option[];
  warehouses: Option[];
  onCategoryCreated: (option: Option) => void;
  onSupplierCreated: (option: Option) => void;
  showOpeningQty: boolean;
  fieldErrors?: { name?: string; sku?: string };
}) {
  const [addingCategory, setAddingCategory] = useState(false);
  const [addingSupplier, setAddingSupplier] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [newSupplierName, setNewSupplierName] = useState("");
  const [savingCategory, setSavingCategory] = useState(false);
  const [savingSupplier, setSavingSupplier] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  async function handleCategorySelect(value: string) {
    if (value === ADD_NEW) {
      setAddingCategory(true);
      return;
    }
    set("categoryId", value);
  }

  async function handleSaveCategory() {
    const name = newCategoryName.trim();
    if (!name) return;
    setSavingCategory(true);
    setFormError(null);
    try {
      const created = await createCategory({ name });
      onCategoryCreated(created);
      set("categoryId", created.id);
      setAddingCategory(false);
      setNewCategoryName("");
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Could not create the category.");
    } finally {
      setSavingCategory(false);
    }
  }

  async function handleSupplierSelect(value: string) {
    if (value === ADD_NEW) {
      setAddingSupplier(true);
      return;
    }
    set("supplierId", value);
  }

  async function handleSaveSupplier() {
    const name = newSupplierName.trim();
    if (!name) return;
    setSavingSupplier(true);
    setFormError(null);
    try {
      const created = await createSupplier({ name });
      onSupplierCreated(created);
      set("supplierId", created.id);
      setAddingSupplier(false);
      setNewSupplierName("");
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Could not create the supplier.");
    } finally {
      setSavingSupplier(false);
    }
  }

  async function handleImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingImage(true);
    setFormError(null);
    try {
      const fd = new FormData();
      fd.set("file", file);
      const url = await uploadProductImage(fd);
      set("imageUrl", url);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Could not upload the image.");
    } finally {
      setUploadingImage(false);
      e.target.value = "";
    }
  }

  function handleGenerateBarcode() {
    set("barcode", generateEan13(form.sku));
  }

  return (
    <div className="flex flex-col gap-[15px]">
      <div className="flex items-start gap-3.5">
        <label className="relative flex h-[88px] w-[88px] flex-shrink-0 cursor-pointer flex-col items-center justify-center gap-1 overflow-hidden rounded-xl border-2 border-dashed border-border bg-surface-2 text-center text-[11px] text-muted">
          {form.imageUrl ? (
            <Image src={form.imageUrl} alt="Product" fill sizes="88px" className="object-cover" />
          ) : uploadingImage ? (
            <span className="text-[11px]">Uploading…</span>
          ) : (
            <>
              <span className="text-[20px]">🖼️</span>
              Add image
            </>
          )}
          <input type="file" accept="image/*" hidden onChange={handleImageChange} />
        </label>
        <div className="flex-1">
          <Field
            label="Product name"
            placeholder="e.g. Organic Whole Milk 1L"
            value={form.name}
            onChange={(e) => set("name", e.target.value)}
            required
            error={fieldErrors?.name}
          />
          <div className="mt-3">
            <Field label="Description" placeholder="Short description" value={form.description} onChange={(e) => set("description", e.target.value)} />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Field label="SKU" placeholder="MLK-001" value={form.sku} onChange={(e) => set("sku", e.target.value)} required error={fieldErrors?.sku} />
        <Field label="Brand" placeholder="e.g. Farmhouse" value={form.brand} onChange={(e) => set("brand", e.target.value)} />
        <div>
          <label className="mb-1.5 block text-[12.5px] font-semibold text-text-2">Category</label>
          <select
            value={form.categoryId}
            onChange={(e) => handleCategorySelect(e.target.value)}
            className="h-[40px] w-full rounded-[9px] border border-border bg-surface-2 px-3 text-[13.5px] text-text"
          >
            <option value="">None</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
            <option value={ADD_NEW}>+ Add new…</option>
          </select>
          {addingCategory && (
            <div className="mt-1.5 flex gap-1.5">
              <input
                autoFocus
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                placeholder="New category name"
                className="h-8 flex-1 rounded-[7px] border border-border bg-surface px-2 text-[12.5px] text-text outline-none"
              />
              <button
                type="button"
                onClick={handleSaveCategory}
                disabled={savingCategory}
                className="h-8 rounded-[7px] bg-accent px-2.5 text-[12px] font-semibold text-white"
              >
                {savingCategory ? "…" : "Save"}
              </button>
            </div>
          )}
        </div>
        <Field label="Unit" placeholder="each" value={form.unit} onChange={(e) => set("unit", e.target.value)} />
        <Field label="Cost price" placeholder="1.20" type="number" step="0.01" value={form.costPrice} onChange={(e) => set("costPrice", e.target.value)} />
        <Field label="Selling price" placeholder="2.49" type="number" step="0.01" value={form.sellPrice} onChange={(e) => set("sellPrice", e.target.value)} />
        <Field label="Reorder level" placeholder="120" type="number" value={form.reorderLevel} onChange={(e) => set("reorderLevel", e.target.value)} />
        <div>
          <label className="mb-1.5 block text-[12.5px] font-semibold text-text-2">Supplier</label>
          <select
            value={form.supplierId}
            onChange={(e) => handleSupplierSelect(e.target.value)}
            className="h-[40px] w-full rounded-[9px] border border-border bg-surface-2 px-3 text-[13.5px] text-text"
          >
            <option value="">None</option>
            {suppliers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
            <option value={ADD_NEW}>+ Add new…</option>
          </select>
          {addingSupplier && (
            <div className="mt-1.5 flex gap-1.5">
              <input
                autoFocus
                value={newSupplierName}
                onChange={(e) => setNewSupplierName(e.target.value)}
                placeholder="New supplier name"
                className="h-8 flex-1 rounded-[7px] border border-border bg-surface px-2 text-[12.5px] text-text outline-none"
              />
              <button
                type="button"
                onClick={handleSaveSupplier}
                disabled={savingSupplier}
                className="h-8 rounded-[7px] bg-accent px-2.5 text-[12px] font-semibold text-white"
              >
                {savingSupplier ? "…" : "Save"}
              </button>
            </div>
          )}
        </div>
        <div>
          <label className="mb-1.5 block text-[12.5px] font-semibold text-text-2">Warehouse</label>
          <select
            value={form.warehouseId}
            onChange={(e) => set("warehouseId", e.target.value)}
            className="h-[40px] w-full rounded-[9px] border border-border bg-surface-2 px-3 text-[13.5px] text-text"
          >
            <option value="">None</option>
            {warehouses.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name}
              </option>
            ))}
          </select>
        </div>
        <Field label="Expiry date" type="date" value={form.expiryDate} onChange={(e) => set("expiryDate", e.target.value)} />
        {showOpeningQty && (
          <Field label="Opening qty" placeholder="0" type="number" value={form.openingQty} onChange={(e) => set("openingQty", e.target.value)} />
        )}
      </div>

      <div>
        <label className="mb-1.5 block text-[12.5px] font-semibold text-text-2">Barcode</label>
        <div className="flex gap-2">
          <div className="flex-1">
            <Field placeholder="Scan or generate" value={form.barcode} onChange={(e) => set("barcode", e.target.value)} />
          </div>
          <button
            type="button"
            onClick={handleGenerateBarcode}
            className="h-[42px] rounded-[9px] border border-border bg-surface px-3 text-[13px] font-semibold text-text hover:bg-hover"
          >
            Generate
          </button>
        </div>
        {form.barcode && (
          <div className="mt-2 flex justify-center rounded-[9px] border border-border bg-white p-2">
            <BarcodePreview value={form.barcode} />
          </div>
        )}
      </div>

      {formError && <p className="text-[13px] font-medium text-red">{formError}</p>}
    </div>
  );
}
