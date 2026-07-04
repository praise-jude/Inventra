"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/app/ToastProvider";
import { createSupplier, updateSupplier } from "@/lib/actions/suppliers";
import type { SupplierRow } from "@/lib/queries/suppliers";
import { Field } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";

export function SupplierModal({ supplier, onClose }: { supplier?: SupplierRow; onClose: () => void }) {
  const router = useRouter();
  const flash = useToast();
  const [form, setForm] = useState({
    name: supplier?.name ?? "",
    company: supplier?.company ?? "",
    contactPerson: supplier?.contactPerson ?? "",
    email: supplier?.email ?? "",
    phone: supplier?.phone ?? "",
    address: supplier?.address ?? "",
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
      if (supplier) {
        await updateSupplier(supplier.id, form);
        flash("Supplier updated");
      } else {
        await createSupplier(form);
        flash("Supplier created");
      }
      onClose();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save the supplier.");
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
        className="animate-scale-in w-full max-w-[500px] rounded-2xl border border-border bg-surface shadow-[var(--shadow-lg)]"
      >
        <div className="flex items-center justify-between border-b border-border px-[22px] py-[18px]">
          <div className="text-[16px] font-bold">{supplier ? "Edit supplier" : "New supplier"}</div>
          <button type="button" onClick={onClose} className="h-8 w-8 rounded-[8px] border border-border bg-surface text-text">
            ✕
          </button>
        </div>
        <div className="flex flex-col gap-3.5 px-[22px] py-5">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Supplier name" value={form.name} onChange={(e) => set("name", e.target.value)} required />
            <Field label="Company" value={form.company} onChange={(e) => set("company", e.target.value)} />
            <Field label="Contact person" value={form.contactPerson} onChange={(e) => set("contactPerson", e.target.value)} />
            <Field label="Email" type="email" value={form.email} onChange={(e) => set("email", e.target.value)} />
            <Field label="Phone" value={form.phone} onChange={(e) => set("phone", e.target.value)} />
            <Field label="Address" value={form.address} onChange={(e) => set("address", e.target.value)} />
          </div>
          {error && <p className="text-[13px] font-medium text-red">{error}</p>}
        </div>
        <div className="flex justify-end gap-2.5 border-t border-border px-[22px] py-4">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={saving}>
            {saving ? "Saving…" : supplier ? "Save changes" : "Create supplier"}
          </Button>
        </div>
      </form>
    </div>
  );
}
