"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/app/ToastProvider";
import { changePlan } from "@/lib/actions/billing";
import { PLANS } from "@/lib/billing-plans";
import type { Invoice } from "@/lib/billing-plans";
import { useWorkspace } from "@/components/app/CurrencyProvider";

interface Props {
  planKey: string;
  seatsUsed: number;
  skuCount: number;
  warehouseCount: number;
  renewsAt: string;
  invoices: Invoice[];
}

const INVOICE_STYLE: Record<string, { color: string; background: string }> = {
  paid: { color: "var(--green)", background: "var(--green-weak)" },
  pending: { color: "var(--amber)", background: "var(--amber-weak)" },
  failed: { color: "var(--red)", background: "var(--red-weak)" },
};

export function BillingClient({ planKey, seatsUsed, skuCount, warehouseCount, renewsAt, invoices }: Props) {
  const router = useRouter();
  const flash = useToast();
  const { format: formatMoney, formatShortDate, formatLongDate } = useWorkspace();
  const [busy, setBusy] = useState<string | null>(null);
  const current = PLANS.find((p) => p.key === planKey) ?? PLANS[0];

  async function handleChange(key: "starter" | "growth" | "scale") {
    setBusy(key);
    try {
      await changePlan(key);
      flash(`Switched to ${key[0].toUpperCase() + key.slice(1)} plan`);
      router.refresh();
    } catch (err) {
      flash(err instanceof Error ? err.message : "Could not change plan.");
    } finally {
      setBusy(null);
    }
  }

  function downloadInvoice(inv: Invoice) {
    const body = [
      "STOCKWELL — TAX INVOICE",
      "",
      `Invoice number: ${inv.invoice_number}`,
      `Issued:         ${formatLongDate(inv.issued_at)}`,
      `Status:         ${inv.status.toUpperCase()}`,
      "",
      `Plan subscription (${current.name})    ${formatMoney(inv.amount)}`,
      "----------------------------------------",
      `Total                          ${formatMoney(inv.amount)}`,
      "",
      "Thank you for your business.",
    ].join("\n");
    const blob = new Blob([body], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${inv.invoice_number}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="animate-fade-up">
      <div className="mb-[18px]">
        <div className="text-[22px] font-bold tracking-tight">Billing &amp; plans</div>
        <div className="mt-[3px] text-text-2">Manage your subscription, seats, and invoices.</div>
      </div>

      <div
        className="mb-[18px] flex flex-wrap items-center justify-between gap-4.5 rounded-2xl p-[20px_22px] text-white shadow-[var(--shadow)]"
        style={{ background: "linear-gradient(135deg,var(--accent),#6366f1)" }}
      >
        <div>
          <div className="text-[12.5px] font-bold uppercase tracking-[0.05em] opacity-85">{current.name} plan</div>
          <div className="mt-1 text-[26px] font-bold">
            {formatMoney(current.price)}
            <span className="text-[15px] font-semibold opacity-85">/mo</span> · renews{" "}
            {formatShortDate(renewsAt)}
          </div>
        </div>
        <div className="flex gap-6">
          <div>
            <div className="text-[12px] opacity-85">Seats</div>
            <div className="text-[19px] font-bold">
              {seatsUsed} / {current.seatLimit === Infinity ? "∞" : current.seatLimit}
            </div>
          </div>
          <div>
            <div className="text-[12px] opacity-85">SKUs</div>
            <div className="text-[19px] font-bold">
              {skuCount} / {current.skuLimit === Infinity ? "∞" : current.skuLimit}
            </div>
          </div>
          <div>
            <div className="text-[12px] opacity-85">Warehouses</div>
            <div className="text-[19px] font-bold">
              {warehouseCount} / {current.warehouseLimit === Infinity ? "∞" : current.warehouseLimit}
            </div>
          </div>
        </div>
        <button
          onClick={() => flash("Card payments are handled by Stripe — connect it under Settings → Integrations.")}
          className="h-[38px] rounded-[9px] bg-white px-4.5 text-[13.5px] font-bold text-accent-2"
        >
          Manage payment
        </button>
      </div>

      <div className="mb-5 grid gap-3.5" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))" }}>
        {PLANS.map((p) => {
          const isCurrent = p.key === planKey;
          return (
            <div
              key={p.key}
              className="relative flex flex-col rounded-2xl border bg-surface p-5"
              style={{
                borderWidth: isCurrent ? 1.5 : 1,
                borderColor: isCurrent ? "var(--accent)" : "var(--border)",
                boxShadow: isCurrent ? "var(--shadow)" : "var(--shadow-sm)",
              }}
            >
              {isCurrent && (
                <div className="absolute -top-px right-4 rounded-b-[7px] bg-accent px-[9px] py-[3px] text-[10.5px] font-bold uppercase tracking-[0.04em] text-white">
                  Current
                </div>
              )}
              <div className="text-[16px] font-bold">{p.name}</div>
              <div className="mt-1.5 text-[28px] font-extrabold tracking-tight">
                {formatMoney(p.price)}
                <span className="text-[14px] font-semibold text-muted">/mo</span>
              </div>
              <div className="mb-3.5 mt-0.5 text-[12.5px] leading-relaxed text-text-2">{p.desc}</div>
              <div className="mb-4 flex flex-col gap-2">
                {p.features.map((f) => (
                  <div key={f} className="flex items-center gap-2 text-[12.5px] text-text-2">
                    <span className="font-extrabold text-green">✓</span>
                    {f}
                  </div>
                ))}
              </div>
              <button
                disabled={isCurrent || busy !== null}
                onClick={() => handleChange(p.key as "starter" | "growth" | "scale")}
                className="mt-auto h-[38px] rounded-[9px] text-[13px] font-semibold"
                style={
                  isCurrent
                    ? { border: "1px solid var(--border)", background: "var(--hover)", color: "var(--muted)", cursor: "default" }
                    : { border: "none", background: "var(--accent)", color: "#fff", cursor: "pointer" }
                }
              >
                {isCurrent ? "Current plan" : busy === p.key ? "Switching…" : PLANS.indexOf(p) > PLANS.findIndex((x) => x.key === planKey) ? "Upgrade" : "Downgrade"}
              </button>
            </div>
          );
        })}
      </div>

      <div className="overflow-hidden rounded-[14px] border border-border bg-surface shadow-[var(--shadow-sm)]">
        <div className="border-b border-border-2 px-4 py-3.5 text-[14px] font-bold">Invoice history</div>
        {invoices.map((i) => (
          <div key={i.id} className="flex items-center gap-3.5 border-t border-border-2 px-4 py-3 hover:bg-hover">
            <span className="flex h-8 w-8 items-center justify-center rounded-[8px] bg-accent-weak text-[14px]">🧾</span>
            <div className="flex-1">
              <div className="font-mono text-[13px] font-semibold">{i.invoice_number}</div>
              <div className="text-[11.5px] text-muted">{formatLongDate(i.issued_at)}</div>
            </div>
            <span className="font-mono text-[13px] font-bold">{formatMoney(i.amount)}</span>
            <span className="rounded-[20px] px-[9px] py-0.5 text-[11.5px] font-bold capitalize" style={INVOICE_STYLE[i.status]}>
              {i.status}
            </span>
            <button onClick={() => downloadInvoice(i)} className="cursor-pointer text-[12.5px] font-semibold text-accent-text">
              Download
            </button>
          </div>
        ))}
        {invoices.length === 0 && <div className="px-4 py-6 text-center text-[13px] text-muted">No invoices yet.</div>}
      </div>
    </div>
  );
}
