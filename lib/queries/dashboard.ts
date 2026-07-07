import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import type {
  CategoryMixRow,
  DailyProductProfitRow,
  DashboardKpis,
  MonthlyStat,
  StockHealthRow,
  TopSellerRow,
} from "@/lib/supabase/database.types";

// Both the app-shell layout (sidebar badge) and the dashboard page itself
// need these KPIs on every dashboard request — cache() dedupes them to a
// single RPC round trip per request instead of two.
export const getKpis = cache(async (): Promise<DashboardKpis> => {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_kpis");
  if (error) throw error;
  return data as DashboardKpis;
});

export async function getCategoryMix(): Promise<CategoryMixRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_category_mix");
  if (error) throw error;
  return (data ?? []) as CategoryMixRow[];
}

export async function getTopSellers(limit = 5): Promise<TopSellerRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_top_sellers", { p_limit: limit });
  if (error) throw error;
  return (data ?? []) as TopSellerRow[];
}

export async function getStockHealth(): Promise<StockHealthRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_stock_health");
  if (error) throw error;
  return (data ?? []) as StockHealthRow[];
}

export async function getMonthlyStats(): Promise<MonthlyStat[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("monthly_stats")
    .select("*")
    .order("month", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

// Sales *volume* (transaction count) is a distinct signal from monthly_stats'
// revenue/profit — it lets the dashboard show a real "sales trend" chart
// instead of duplicating the revenue line under a different label.
export async function getMonthlySalesVolume(): Promise<{ month: string; count: number }[]> {
  const supabase = await createClient();
  const since = new Date();
  since.setUTCMonth(since.getUTCMonth() - 11, 1);
  const { data, error } = await supabase
    .from("sales")
    .select("created_at")
    .gte("created_at", since.toISOString());
  if (error) throw error;

  const byMonth = new Map<string, number>();
  for (const row of data ?? []) {
    const key = row.created_at.slice(0, 7); // YYYY-MM
    byMonth.set(key, (byMonth.get(key) ?? 0) + 1);
  }
  const months: { month: string; count: number }[] = [];
  const cursor = new Date(since);
  for (let i = 0; i < 12; i++) {
    const key = `${cursor.getUTCFullYear()}-${String(cursor.getUTCMonth() + 1).padStart(2, "0")}`;
    months.push({ month: `${key}-01`, count: byMonth.get(key) ?? 0 });
    cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  }
  return months;
}

// The deployed RPC always computes for the current date server-side and
// takes no arguments — there is no p_date parameter to pass.
export async function getDailyProductProfit(): Promise<DailyProductProfitRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_daily_product_profit");
  if (error) throw error;
  return (data ?? []) as DailyProductProfitRow[];
}

export interface ActivityRow {
  id: string;
  type: string;
  qty_delta: number;
  reason: string | null;
  created_at: string;
  products: { name: string } | null;
  profiles: { first_name: string; last_name: string } | null;
}

export async function getRecentActivity(limit = 5): Promise<ActivityRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("stock_movements")
    .select("id, type, qty_delta, reason, created_at, products(name), profiles(first_name, last_name)")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as unknown as ActivityRow[];
}
