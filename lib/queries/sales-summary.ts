import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { PaymentMethod } from "@/lib/supabase/database.types";

export interface DailySalesSummaryRow {
  day: string;
  totalSales: number;
  salesCount: number;
  itemsSold: number;
}

// Backs the Audit Log's Sales Summary panel — daily rows for a range, plus
// the monthly rollup (total/average/highest/lowest day), all derived from
// this one query so they can never drift apart from each other. Revenue/
// sales_count come from the same `sales` table get_sales_summary()/
// get_sales_by_period() (lib/queries/reports.ts) already use, so these
// numbers agree with the Reports page's Sales tab by construction.
export async function getDailySalesSummary(from: string, to: string): Promise<DailySalesSummaryRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_daily_sales_summary", { p_from: from, p_to: to });
  if (error) {
    console.error("[Inventra] getDailySalesSummary failed:", error);
    throw new Error("Could not load the sales summary.");
  }
  return ((data ?? []) as { day: string; total_sales: number; sales_count: number; items_sold: number }[]).map((r) => ({
    day: r.day,
    totalSales: Number(r.total_sales),
    salesCount: Number(r.sales_count),
    itemsSold: Number(r.items_sold),
  }));
}

export interface DaySaleRow {
  id: string;
  customerName: string;
  cashierName: string;
  paymentSummary: string;
  total: number;
  createdAt: string;
}

const PAYMENT_LABEL: Record<PaymentMethod, string> = {
  cash: "Cash",
  card: "Card",
  bank_transfer: "Bank Transfer",
  mobile_money: "Mobile Money",
};

// Drill-down for one day from the Sales Summary panel — bounded to 200 rows
// (a day with more sales than that needs the full Sales page's own search/
// pagination, not a summary drill-down) rather than a dedicated pagination
// UI for what's meant to be a quick "what happened that day" glance.
export async function getSalesForDay(day: string): Promise<DaySaleRow[]> {
  const supabase = await createClient();
  const nextDay = new Date(`${day}T00:00:00.000Z`);
  nextDay.setUTCDate(nextDay.getUTCDate() + 1);

  const { data: sales, error } = await supabase
    .from("sales")
    .select("id, walk_in_name, total, created_at, customers(name), profiles!sales_created_by_fkey(first_name, last_name)")
    .gte("created_at", `${day}T00:00:00.000Z`)
    .lt("created_at", nextDay.toISOString().slice(0, 10))
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) {
    console.error("[Inventra] getSalesForDay (sales) failed:", error);
    throw new Error("Could not load sales for this day.");
  }

  const saleIds = (sales ?? []).map((s) => s.id);
  if (saleIds.length === 0) return [];

  const { data: payments, error: payError } = await supabase.from("sale_payments").select("sale_id, method").in("sale_id", saleIds);
  if (payError) {
    console.error("[Inventra] getSalesForDay (payments) failed:", payError);
    throw new Error("Could not load sales for this day.");
  }

  const methodsBySale = new Map<string, PaymentMethod[]>();
  for (const p of payments ?? []) {
    methodsBySale.set(p.sale_id, [...(methodsBySale.get(p.sale_id) ?? []), p.method]);
  }

  return (sales ?? []).map((s) => {
    const methods = methodsBySale.get(s.id) ?? [];
    const paymentSummary =
      methods.length === 0 ? "—" : methods.length === 1 ? PAYMENT_LABEL[methods[0]] : `Split (${methods.length})`;
    const cashier = s.profiles as unknown as { first_name: string; last_name: string } | null;
    return {
      id: s.id,
      customerName: (s.customers as unknown as { name: string } | null)?.name ?? s.walk_in_name ?? "Walk-in customer",
      cashierName: cashier ? `${cashier.first_name} ${cashier.last_name}` : "—",
      paymentSummary,
      total: Number(s.total),
      createdAt: s.created_at,
    };
  });
}
