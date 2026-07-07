"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/app/ToastProvider";
import { fetchProductsInWarehouse, transferWarehouseStock } from "@/lib/actions/warehouses";
import type { WarehouseProductOption } from "@/lib/queries/inventory";
import { Field } from "@/components/ui/Field";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";

interface WarehouseOption {
  id: string;
  name: string;
}

export function TransferStockModal({
  fromWarehouse,
  destinations,
  onClose,
}: {
  fromWarehouse: WarehouseOption;
  destinations: WarehouseOption[];
  onClose: () => void;
}) {
  const router = useRouter();
  const flash = useToast();
  const [products, setProducts] = useState<WarehouseProductOption[] | null>(null);
  const [productId, setProductId] = useState("");
  const [toWarehouseId, setToWarehouseId] = useState(destinations[0]?.id ?? "");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchProductsInWarehouse(fromWarehouse.id).then(setProducts);
  }, [fromWarehouse.id]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!productId) {
      setError("Choose a product to transfer.");
      return;
    }
    if (!toWarehouseId) {
      setError("Choose a destination warehouse.");
      return;
    }
    setSaving(true);
    try {
      await transferWarehouseStock(productId, toWarehouseId, reason);
      flash("Product transferred");
      onClose();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not transfer the product.");
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
        className="animate-scale-in w-full max-w-[460px] rounded-2xl border border-border bg-surface shadow-[var(--shadow-lg)]"
      >
        <div className="flex items-center justify-between border-b border-border px-[22px] py-[18px]">
          <div className="text-[16px] font-bold">Transfer stock from {fromWarehouse.name}</div>
          <button type="button" onClick={onClose} className="h-8 w-8 rounded-[8px] border border-border bg-surface text-text">
            ✕
          </button>
        </div>
        <div className="flex flex-col gap-3.5 px-[22px] py-5">
          {products === null ? (
            <p className="text-[12.5px] text-muted">Loading products…</p>
          ) : products.length === 0 ? (
            <p className="text-[12.5px] text-muted">No products in this warehouse to transfer.</p>
          ) : (
            <Select label="Product" value={productId} onChange={(e) => setProductId(e.target.value)} required>
              <option value="">Select a product…</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} · {p.sku} · {p.qtyOnHand} units
                </option>
              ))}
            </Select>
          )}
          <Select label="Destination warehouse" value={toWarehouseId} onChange={(e) => setToWarehouseId(e.target.value)} required>
            {destinations.length === 0 && <option value="">No other warehouses available</option>}
            {destinations.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name}
              </option>
            ))}
          </Select>
          <Field label="Reason (optional)" placeholder="e.g. Rebalancing stock" value={reason} onChange={(e) => setReason(e.target.value)} />
          <p className="text-[11.5px] text-muted">
            The product moves entirely to the destination warehouse. This is logged in Inventory → Movements for audit.
          </p>
          {error && <p className="text-[13px] font-medium text-red">{error}</p>}
        </div>
        <div className="flex justify-end gap-2.5 border-t border-border px-[22px] py-4">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={saving || !products?.length || destinations.length === 0}>
            {saving ? "Transferring…" : "Transfer"}
          </Button>
        </div>
      </form>
    </div>
  );
}
