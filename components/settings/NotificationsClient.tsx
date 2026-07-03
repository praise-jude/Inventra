"use client";

import { useState, useTransition } from "react";
import { toggleNotification } from "@/lib/actions/settings";

const META = [
  { field: "low_stock", title: "Low stock alerts", desc: "When a product drops below reorder level", icon: "⚠️", bg: "var(--amber-weak)" },
  { field: "out_of_stock", title: "Out of stock", desc: "When a product hits zero units", icon: "⛔", bg: "var(--red-weak)" },
  { field: "expiring_products", title: "Expiring products", desc: "7 days before batch expiry", icon: "⏳", bg: "var(--sky-weak)" },
  { field: "new_purchase_orders", title: "New purchase orders", desc: "When a PO is created or received", icon: "📥", bg: "var(--green-weak)" },
  { field: "weekly_digest", title: "Weekly digest", desc: "Sales & profit summary every Monday", icon: "📊", bg: "var(--accent-weak)" },
] as const;

export function NotificationsClient({ initial }: { initial: Record<string, boolean> }) {
  const [state, setState] = useState(initial);
  const [, startTransition] = useTransition();

  function toggle(field: string) {
    const next = !state[field];
    setState((s) => ({ ...s, [field]: next }));
    startTransition(() => {
      toggleNotification(field, next);
    });
  }

  return (
    <div className="rounded-2xl border border-border bg-surface px-5 shadow-[var(--shadow-sm)]">
      {META.map((n, i) => {
        const on = state[n.field];
        return (
          <div
            key={n.field}
            className="flex items-center gap-3.5 py-[15px]"
            style={{ borderBottom: i < META.length - 1 ? "1px solid var(--border-2)" : "none" }}
          >
            <span className="flex h-[34px] w-[34px] items-center justify-center rounded-[9px] text-[15px]" style={{ background: n.bg }}>
              {n.icon}
            </span>
            <div className="flex-1">
              <div className="text-[13.5px] font-semibold">{n.title}</div>
              <div className="text-[12px] text-muted">{n.desc}</div>
            </div>
            <div
              onClick={() => toggle(n.field)}
              className="relative h-[23px] w-10 flex-shrink-0 cursor-pointer rounded-[20px] transition-colors"
              style={{ background: on ? "var(--accent)" : "var(--border)" }}
            >
              <div
                className="absolute top-[2.5px] h-[18px] w-[18px] rounded-full bg-white shadow-[0_1px_3px_rgba(0,0,0,.25)] transition-all"
                style={{ left: on ? "19px" : "2.5px" }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
