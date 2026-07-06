"use server";

import { createClient } from "@/lib/supabase/server";

export interface StockAlert {
  id: string;
  productId: string;
  emoji: string | null;
  title: string;
  detail: string;
  severity: "red" | "amber" | "sky";
}

// Feeds the topbar bell: real alerts derived from the catalog instead of a
// hardcoded count — out-of-stock, low-stock, and expiring-soon products.
export async function getStockAlerts(): Promise<StockAlert[]> {
  const supabase = await createClient();
  const in7 = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const { data } = await supabase
    .from("products")
    .select("id, name, emoji, qty_on_hand, reorder_level, status, expiry_date")
    .is("archived_at", null)
    .or(`status.neq.in_stock,expiry_date.lte.${in7}`)
    .order("qty_on_hand", { ascending: true })
    .limit(12);

  const alerts: StockAlert[] = [];
  for (const p of data ?? []) {
    if (p.status === "out_of_stock") {
      alerts.push({ id: `${p.id}-out`, productId: p.id, emoji: p.emoji, title: `${p.name} is out of stock`, detail: "0 units on hand", severity: "red" });
    } else if (p.status === "low_stock") {
      alerts.push({ id: `${p.id}-low`, productId: p.id, emoji: p.emoji, title: `${p.name} is low on stock`, detail: `${p.qty_on_hand} left · reorder at ${p.reorder_level}`, severity: "amber" });
    }
    if (p.expiry_date && p.expiry_date <= in7) {
      const days = Math.max(0, Math.ceil((new Date(p.expiry_date).getTime() - Date.now()) / (24 * 60 * 60 * 1000)));
      alerts.push({ id: `${p.id}-exp`, productId: p.id, emoji: p.emoji, title: `${p.name} expires soon`, detail: days === 0 ? "expires today" : `expires in ${days} day${days === 1 ? "" : "s"}`, severity: "sky" });
    }
  }
  return alerts.slice(0, 10);
}
