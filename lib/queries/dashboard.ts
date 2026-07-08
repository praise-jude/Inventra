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

// Kept for scripts/seed.ts's demo data — the live dashboard no longer reads
// from this table (see getMonthlyRevenueProfit below): monthly_stats is only
// ever populated with hardcoded numbers by the seed script, so for every real
// org it has zero rows and left the Monthly profit KPI and trend chart blank.
export async function getMonthlyStats(): Promise<MonthlyStat[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("monthly_stats")
    .select("*")
    .order("month", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

// Live-computed revenue/profit per month from the stock_movements ledger —
// only returns rows for months that actually had a sale (sparse); the caller
// is responsible for filling gap months with 0 against a canonical month list.
export async function getMonthlyRevenueProfit(): Promise<{ month: string; revenue: number; profit: number }[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_monthly_revenue_profit");
  if (error) throw error;
  return ((data ?? []) as { month: string; revenue: number; profit: number }[]).map((r) => ({
    month: r.month,
    revenue: Number(r.revenue),
    profit: Number(r.profit),
  }));
}

// Sales *volume* (transaction count) is a distinct signal from revenue/profit
// — it lets the dashboard show a real "sales trend" chart instead of
// duplicating the revenue line under a different label. Sparse, same as
// getMonthlyRevenueProfit above — caller fills gap months with 0.
export async function getMonthlySalesVolume(): Promise<{ month: string; count: number }[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_monthly_sales_volume");
  if (error) throw error;
  return ((data ?? []) as { month: string; count: number }[]).map((row) => ({ month: row.month, count: Number(row.count) }));
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
