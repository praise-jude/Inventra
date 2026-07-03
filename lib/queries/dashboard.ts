import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { CategoryMixRow, DashboardKpis, MonthlyStat, StockHealthRow, TopSellerRow } from "@/lib/supabase/database.types";

export async function getKpis(): Promise<DashboardKpis> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_kpis");
  if (error) throw error;
  return data as DashboardKpis;
}

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
