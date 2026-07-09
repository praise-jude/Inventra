import "server-only";
import { createClient } from "@/lib/supabase/server";

export interface SalesSummary {
  revenue: number;
  discount: number;
  tax: number;
  salesCount: number;
  profit: number;
}

export interface SalesPeriodRow {
  period: string;
  revenue: number;
  salesCount: number;
  profit: number;
}

export interface SalesByBranchRow {
  warehouseId: string;
  warehouseName: string;
  revenue: number;
  salesCount: number;
}

export interface SalesByProductRow {
  productId: string;
  name: string;
  sku: string;
  units: number;
  revenue: number;
  profit: number;
}

export interface SalesByStaffRow {
  staffId: string | null;
  staffName: string;
  revenue: number;
  salesCount: number;
}

export interface InventoryValuationRow {
  productId: string;
  name: string;
  sku: string;
  warehouseId: string | null;
  warehouseName: string | null;
  qtyOnHand: number;
  costPrice: number;
  sellPrice: number;
  inventoryValue: number;
  expectedProfit: number;
}

export interface ProfitLoss {
  revenue: number;
  cogs: number;
  grossProfit: number;
  operatingExpenses: number;
  netProfit: number;
  marginPct: number;
}

export type Granularity = "day" | "week" | "month" | "year";

export async function getSalesSummary(from: string, to: string, warehouseId?: string): Promise<SalesSummary> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_sales_summary", { p_from: from, p_to: to, p_warehouse_id: warehouseId ?? null });
  if (error) {
    console.error("[Inventra] getSalesSummary failed:", error);
    throw new Error("Could not load the sales summary.");
  }
  const d = data as { revenue: number; discount: number; tax: number; sales_count: number; profit: number };
  return { revenue: Number(d.revenue), discount: Number(d.discount), tax: Number(d.tax), salesCount: Number(d.sales_count), profit: Number(d.profit) };
}

export async function getSalesByPeriod(from: string, to: string, granularity: Granularity, warehouseId?: string): Promise<SalesPeriodRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_sales_by_period", {
    p_from: from,
    p_to: to,
    p_granularity: granularity,
    p_warehouse_id: warehouseId ?? null,
  });
  if (error) {
    console.error("[Inventra] getSalesByPeriod failed:", error);
    throw new Error("Could not load the sales trend.");
  }
  return ((data ?? []) as { period: string; revenue: number; sales_count: number; profit: number }[]).map((r) => ({
    period: r.period,
    revenue: Number(r.revenue),
    salesCount: Number(r.sales_count),
    profit: Number(r.profit),
  }));
}

export async function getSalesByBranch(from: string, to: string): Promise<SalesByBranchRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_sales_by_branch", { p_from: from, p_to: to });
  if (error) {
    console.error("[Inventra] getSalesByBranch failed:", error);
    throw new Error("Could not load sales by branch.");
  }
  return ((data ?? []) as { warehouse_id: string; warehouse_name: string; revenue: number; sales_count: number }[]).map((r) => ({
    warehouseId: r.warehouse_id,
    warehouseName: r.warehouse_name,
    revenue: Number(r.revenue),
    salesCount: Number(r.sales_count),
  }));
}

export async function getSalesByProduct(from: string, to: string, warehouseId?: string): Promise<SalesByProductRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_sales_by_product", { p_from: from, p_to: to, p_warehouse_id: warehouseId ?? null });
  if (error) {
    console.error("[Inventra] getSalesByProduct failed:", error);
    throw new Error("Could not load sales by product.");
  }
  return ((data ?? []) as { product_id: string; name: string; sku: string; units: number; revenue: number; profit: number }[]).map((r) => ({
    productId: r.product_id,
    name: r.name,
    sku: r.sku,
    units: Number(r.units),
    revenue: Number(r.revenue),
    profit: Number(r.profit),
  }));
}

export async function getSalesByStaff(from: string, to: string, warehouseId?: string): Promise<SalesByStaffRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_sales_by_staff", { p_from: from, p_to: to, p_warehouse_id: warehouseId ?? null });
  if (error) {
    console.error("[Inventra] getSalesByStaff failed:", error);
    throw new Error("Could not load sales by staff.");
  }
  return ((data ?? []) as { staff_id: string | null; staff_name: string; revenue: number; sales_count: number }[]).map((r) => ({
    staffId: r.staff_id,
    staffName: r.staff_name,
    revenue: Number(r.revenue),
    salesCount: Number(r.sales_count),
  }));
}

export async function getInventoryValuation(warehouseId?: string): Promise<InventoryValuationRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_inventory_valuation", { p_warehouse_id: warehouseId ?? null });
  if (error) {
    console.error("[Inventra] getInventoryValuation failed:", error);
    throw new Error("Could not load the inventory valuation.");
  }
  return (
    (data ?? []) as {
      product_id: string;
      name: string;
      sku: string;
      warehouse_id: string | null;
      warehouse_name: string | null;
      qty_on_hand: number;
      cost_price: number;
      sell_price: number;
      inventory_value: number;
      expected_profit: number;
    }[]
  ).map((r) => ({
    productId: r.product_id,
    name: r.name,
    sku: r.sku,
    warehouseId: r.warehouse_id,
    warehouseName: r.warehouse_name,
    qtyOnHand: Number(r.qty_on_hand),
    costPrice: Number(r.cost_price),
    sellPrice: Number(r.sell_price),
    inventoryValue: Number(r.inventory_value),
    expectedProfit: Number(r.expected_profit),
  }));
}

export async function getProfitLoss(from: string, to: string, warehouseId?: string, productId?: string): Promise<ProfitLoss> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_profit_loss", {
    p_from: from,
    p_to: to,
    p_warehouse_id: warehouseId ?? null,
    p_product_id: productId ?? null,
  });
  if (error) {
    console.error("[Inventra] getProfitLoss failed:", error);
    throw new Error("Could not load the profit & loss statement.");
  }
  const d = data as { revenue: number; cogs: number; gross_profit: number; operating_expenses: number; net_profit: number; margin_pct: number };
  return {
    revenue: Number(d.revenue),
    cogs: Number(d.cogs),
    grossProfit: Number(d.gross_profit),
    operatingExpenses: Number(d.operating_expenses),
    netProfit: Number(d.net_profit),
    marginPct: Number(d.margin_pct),
  };
}
