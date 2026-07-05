"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useToast } from "@/components/app/ToastProvider";
import { createAdjustment } from "@/lib/actions/inventory";
import type { MovementRow } from "@/lib/queries/inventory";
import { MOVEMENT_META } from "@/lib/movement-meta";
import { Field } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";

interface ProductOption {
  id: string;
  name: string;
  sku: string;
  qty: number;
}

const REASONS = ["Damaged in transit", "Stock recount", "Theft / loss", "Past expiry date", "Other"];

function timeLabel(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const isYesterday = d.toDateString() === yesterday.toDateString();
  const time = d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false });
  if (isToday) return `Today · ${time}`;
  if (isYesterday) return `Yesterday · ${time}`;
  return `${d.toLocaleDateString("en-US", { month: "short", day: "2-digit" })} · ${time}`;
}

function CreateAdjustmentModal({ products, onClose }: { products: ProductOption[]; onClose: () => void }) {
  const router = useRouter();
  const flash = useToast();
  const [productId, setProductId] = useState(products[0]?.id ?? "");
  const [direction, setDirection] = useState<"decrease" | "increase">("decrease");
  const [qty, setQty] = useState("");
  const [reason, setReason] = useState(REASONS[0]);
  const [customReason, setCustomReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const product = products.find((p) => p.id === productId);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const qtyNum = parseInt(qty, 10);
    if (!qtyNum || qtyNum <= 0) {
      setError("Enter a quantity greater than zero.");
      return;
    }
    const finalReason = reason === "Other" ? customReason : reason;
    if (!finalReason.trim()) {
      setError("A reason is required for the audit trail.");
      return;
    }
    setSaving(true);
    try {
      await createAdjustment({
        productId,
        qtyDelta: direction === "decrease" ? -qtyNum : qtyNum,
        reason: finalReason,
        kind: reason === "Past expiry date" ? "expired" : "adjustment",
      });
      flash("Adjustment recorded");
      onClose();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not record adjustment.");
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
        className="animate-scale-in w-full max-w-[440px] rounded-2xl border border-border bg-surface shadow-[var(--shadow-lg)]"
      >
        <div className="flex items-center justify-between border-b border-border px-[22px] py-[18px]">
          <div>
            <div className="text-[16px] font-bold">New adjustment</div>
            <div className="text-[12.5px] text-muted">Correct on-hand stock with a full audit trail.</div>
          </div>
          <button type="button" onClick={onClose} className="h-8 w-8 rounded-[8px] border border-border bg-surface text-text">
            ✕
          </button>
        </div>
        <div className="flex flex-col gap-3.5 px-[22px] py-5">
          <div>
            <label className="mb-1.5 block text-[12.5px] font-semibold text-text-2">Product</label>
            <select
              value={productId}
              onChange={(e) => setProductId(e.target.value)}
              className="h-[42px] w-full rounded-[9px] border border-border bg-surface px-3 text-[14px] text-text"
            >
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} · {p.sku} ({p.qty} on hand)
                </option>
              ))}
            </select>
          </div>
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="mb-1.5 block text-[12.5px] font-semibold text-text-2">Direction</label>
              <div className="flex h-[42px] overflow-hidden rounded-[9px] border border-border">
                {(["decrease", "increase"] as const).map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setDirection(d)}
                    className="flex-1 text-[13px] font-semibold capitalize"
                    style={
                      direction === d
                        ? { background: "var(--accent)", color: "#fff" }
                        : { background: "var(--surface-2)", color: "var(--text-2)" }
                    }
                  >
                    {d === "decrease" ? "− Decrease" : "+ Increase"}
                  </button>
                ))}
              </div>
            </div>
            <div className="w-[120px]">
              <Field label="Quantity" type="number" min={1} placeholder="0" value={qty} onChange={(e) => setQty(e.target.value)} required />
            </div>
          </div>
          <div>
            <label className="mb-1.5 block text-[12.5px] font-semibold text-text-2">Reason</label>
            <select
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="h-[42px] w-full rounded-[9px] border border-border bg-surface px-3 text-[14px] text-text"
            >
              {REASONS.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>
          {reason === "Other" && (
            <Field label="Custom reason" placeholder="e.g. Sample given to customer" value={customReason} onChange={(e) => setCustomReason(e.target.value)} required />
          )}
          {product && direction === "decrease" && (
            <p className="text-[12px] text-muted">
              {product.qty} on hand — stock can&apos;t go below zero.
            </p>
          )}
          {error && <p className="text-[13px] font-medium text-red">{error}</p>}
        </div>
        <div className="flex justify-end gap-2.5 border-t border-border px-[22px] py-4">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={saving}>
            {saving ? "Recording…" : "Record adjustment"}
          </Button>
        </div>
      </form>
    </div>
  );
}

export function AdjustmentsClient({ adjustments, products }: { adjustments: MovementRow[]; products: ProductOption[] }) {
  const searchParams = useSearchParams();
  const [showCreate, setShowCreate] = useState(() => searchParams.get("new") === "1");

  return (
    <div>
      <div className="mb-3.5 flex justify-end">
        <button
          onClick={() => setShowCreate(true)}
          className="h-[37px] rounded-[9px] bg-accent px-4 text-[13px] font-semibold text-white shadow-[var(--shadow-sm)]"
        >
          + New adjustment
        </button>
      </div>

      {adjustments.length === 0 ? (
        <div className="rounded-[14px] border border-border bg-surface px-5 py-[60px] text-center shadow-[var(--shadow-sm)]">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-accent-weak text-[26px]">
            🧾
          </div>
          <div className="mb-1.5 text-[16px] font-bold">No adjustments this period</div>
          <div className="mx-auto mb-4.5 max-w-[340px] text-[13.5px] text-text-2">
            Stock adjustments for damage, loss, or recounts will appear here with a full audit trail.
          </div>
          <button
            onClick={() => setShowCreate(true)}
            className="h-[37px] rounded-[9px] bg-accent px-4 text-[13px] font-semibold text-white"
          >
            Create adjustment
          </button>
        </div>
      ) : (
        <div className="overflow-hidden rounded-[14px] border border-border bg-surface shadow-[var(--shadow-sm)]">
          <div className="scroll overflow-x-auto">
            <table className="w-full min-w-[720px] border-collapse">
              <thead>
                <tr className="bg-surface-2">
                  <th className="px-4 py-[11px] text-left text-[11.5px] font-bold uppercase tracking-[0.04em] text-muted">Type</th>
                  <th className="px-3.5 py-[11px] text-left text-[11.5px] font-bold uppercase tracking-[0.04em] text-muted">Product</th>
                  <th className="px-3.5 py-[11px] text-right text-[11.5px] font-bold uppercase tracking-[0.04em] text-muted">Qty</th>
                  <th className="px-3.5 py-[11px] text-left text-[11.5px] font-bold uppercase tracking-[0.04em] text-muted">Reason</th>
                  <th className="px-3.5 py-[11px] text-left text-[11.5px] font-bold uppercase tracking-[0.04em] text-muted">By</th>
                  <th className="px-4 py-[11px] text-left text-[11.5px] font-bold uppercase tracking-[0.04em] text-muted">When</th>
                </tr>
              </thead>
              <tbody>
                {adjustments.map((m) => {
                  const meta = MOVEMENT_META[m.type];
                  return (
                    <tr key={m.id} className="border-t border-border-2 hover:bg-hover">
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-2 text-[13px] font-semibold">
                          <span className="flex h-7 w-7 items-center justify-center rounded-[8px] text-[13px]" style={{ background: meta.bg }}>
                            {meta.icon}
                          </span>
                          {meta.label}
                        </span>
                      </td>
                      <td className="px-3.5 py-3 text-[13px] font-semibold">{m.product_name}</td>
                      <td
                        className="px-3.5 py-3 text-right font-mono text-[13.5px] font-bold"
                        style={{ color: m.qty_delta >= 0 ? "var(--green)" : "var(--red)" }}
                      >
                        {m.qty_delta >= 0 ? `+${m.qty_delta}` : m.qty_delta}
                      </td>
                      <td className="px-3.5 py-3 text-[12.5px] text-text-2">{m.reason ?? "—"}</td>
                      <td className="px-3.5 py-3 text-[12.5px] text-text-2">{m.who}</td>
                      <td className="px-4 py-3 font-mono text-[12px] text-muted">{timeLabel(m.created_at)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showCreate && <CreateAdjustmentModal products={products} onClose={() => setShowCreate(false)} />}
    </div>
  );
}
