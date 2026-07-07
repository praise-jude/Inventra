"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/app/ToastProvider";
import { createWarehouse, updateWarehouse } from "@/lib/actions/warehouses";
import type { WarehouseOverview } from "@/lib/queries/inventory";
import { Field } from "@/components/ui/Field";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";

interface ManagerOption {
  id: string;
  name: string;
}

export function WarehouseModal({
  warehouse,
  managers,
  onClose,
}: {
  warehouse?: WarehouseOverview;
  managers: ManagerOption[];
  onClose: () => void;
}) {
  const router = useRouter();
  const flash = useToast();
  const [form, setForm] = useState({
    name: warehouse?.name ?? "",
    address: warehouse?.address ?? "",
    managerProfileId: warehouse?.managerProfileId ?? "",
    capacity: warehouse?.capacity ? String(warehouse.capacity) : "",
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
      const input = {
        name: form.name,
        address: form.address,
        managerProfileId: form.managerProfileId,
        capacity: form.capacity ? Number(form.capacity) : undefined,
      };
      if (warehouse) {
        await updateWarehouse(warehouse.id, input);
        flash("Warehouse updated");
      } else {
        await createWarehouse(input);
        flash("Warehouse created");
      }
      onClose();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save the warehouse.");
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
          <div className="text-[16px] font-bold">{warehouse ? "Edit warehouse" : "New warehouse"}</div>
          <button type="button" onClick={onClose} className="h-8 w-8 rounded-[8px] border border-border bg-surface text-text">
            ✕
          </button>
        </div>
        <div className="flex flex-col gap-3.5 px-[22px] py-5">
          <Field label="Warehouse name" value={form.name} onChange={(e) => set("name", e.target.value)} required />
          <Field label="Address" value={form.address} onChange={(e) => set("address", e.target.value)} />
          <div className="grid grid-cols-2 gap-3">
            <Select label="Manager" value={form.managerProfileId} onChange={(e) => set("managerProfileId", e.target.value)}>
              <option value="">Unassigned</option>
              {managers.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </Select>
            <Field
              label="Capacity (units)"
              type="number"
              min="0"
              placeholder="Optional"
              value={form.capacity}
              onChange={(e) => set("capacity", e.target.value)}
            />
          </div>
          {error && <p className="text-[13px] font-medium text-red">{error}</p>}
        </div>
        <div className="flex justify-end gap-2.5 border-t border-border px-[22px] py-4">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={saving}>
            {saving ? "Saving…" : warehouse ? "Save changes" : "Create warehouse"}
          </Button>
        </div>
      </form>
    </div>
  );
}
