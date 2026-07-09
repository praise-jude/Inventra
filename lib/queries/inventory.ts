import "server-only";
import { createClient } from "@/lib/supabase/server";

export interface InventoryCard {
  label: string;
  value: number;
  sub: string;
  icon: string;
  bg: string;
}

interface InventoryCardsTotals {
  current_stock: number;
  reserved: number;
  damaged: number;
  returned: number;
  expiring: number;
}

export async function getInventoryCards(): Promise<InventoryCard[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_inventory_cards").single();
  if (error) throw error;
  const totals = data as InventoryCardsTotals | null;

  const current = totals?.current_stock ?? 0;
  const reserved = totals?.reserved ?? 0;
  const damaged = totals?.damaged ?? 0;
  const returned = totals?.returned ?? 0;
  const expiring = totals?.expiring ?? 0;

  return [
    { label: "Current stock", value: current, sub: "total units", icon: "📦", bg: "var(--accent-weak)" },
    { label: "Reserved", value: reserved, sub: "in open orders", icon: "🔒", bg: "var(--sky-weak)" },
    { label: "Available", value: Math.max(current - reserved, 0), sub: "sellable now", icon: "✅", bg: "var(--green-weak)" },
    { label: "Damaged", value: damaged, sub: "written off", icon: "💢", bg: "var(--red-weak)" },
    { label: "Returned", value: returned, sub: "this month", icon: "↩️", bg: "var(--amber-weak)" },
    { label: "Expiring", value: expiring, sub: "within 7 days", icon: "⏳", bg: "var(--amber-weak)" },
  ];
}

export interface MovementRow {
  id: string;
  type: string;
  qty_delta: number;
  reason: string | null;
  created_at: string;
  product_name: string;
  who: string;
}

export { MOVEMENT_META } from "@/lib/movement-meta";

export async function getStockMovements(limit = 50): Promise<MovementRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("stock_movements")
    .select("id, type, qty_delta, reason, created_at, products(name), profiles(first_name, last_name)")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []).map((m) => ({
    id: m.id,
    type: m.type,
    qty_delta: m.qty_delta,
    reason: m.reason,
    created_at: m.created_at,
    product_name: (m.products as unknown as { name: string } | null)?.name ?? "—",
    who: m.profiles ? `${(m.profiles as unknown as { first_name: string; last_name: string }).first_name} ${(m.profiles as unknown as { first_name: string; last_name: string }).last_name}` : "System",
  }));
}

export interface AdjustmentRow extends MovementRow {
  adjustment_type: string | null;
  notes: string | null;
  branch_name: string | null;
}

// The adjustment log shows manual corrections only — adjustments and expiry
// write-offs — not the full ledger (sales, receipts, transfers, returns).
export async function getAdjustments(limit = 50): Promise<AdjustmentRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("stock_movements")
    .select(
      "id, type, qty_delta, reason, adjustment_type, notes, created_at, products(name), profiles(first_name, last_name), warehouses(name)",
    )
    .in("type", ["adjustment", "expired"])
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []).map((m) => ({
    id: m.id,
    type: m.type,
    qty_delta: m.qty_delta,
    reason: m.reason,
    adjustment_type: m.adjustment_type,
    notes: m.notes,
    created_at: m.created_at,
    product_name: (m.products as unknown as { name: string } | null)?.name ?? "—",
    who: m.profiles ? `${(m.profiles as unknown as { first_name: string; last_name: string }).first_name} ${(m.profiles as unknown as { first_name: string; last_name: string }).last_name}` : "System",
    branch_name: (m.warehouses as unknown as { name: string } | null)?.name ?? null,
  }));
}

export interface WarehouseOverview {
  id: string;
  name: string;
  address: string | null;
  country: string | null;
  state: string | null;
  phone: string | null;
  status: "active" | "inactive";
  managerProfileId: string | null;
  managerName: string | null;
  capacity: number | null;
  skuCount: number;
  stockValue: number;
  utilizationPct: number;
}

export interface WarehouseProductOption {
  id: string;
  name: string;
  sku: string;
  qtyOnHand: number;
}

export async function getProductsInWarehouse(warehouseId: string): Promise<WarehouseProductOption[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("products")
    .select("id, name, sku, qty_on_hand")
    .eq("warehouse_id", warehouseId)
    .is("archived_at", null)
    .order("name");
  if (error) throw error;
  return (data ?? []).map((p) => ({ id: p.id, name: p.name, sku: p.sku, qtyOnHand: p.qty_on_hand }));
}

interface WarehouseStockSummaryRow {
  warehouse_id: string;
  sku_count: number;
  stock_value: number;
  total_units: number;
}

export async function getWarehousesOverview(): Promise<WarehouseOverview[]> {
  const supabase = await createClient();
  const [{ data: warehouses, error }, { data: summary }] = await Promise.all([
    supabase
      .from("warehouses")
      .select("id, name, address, country, state, phone, status, capacity, manager_profile_id, profiles(first_name, last_name)")
      .order("name"),
    supabase.rpc("get_warehouse_stock_summary"),
  ]);
  if (error) throw error;

  const summaryById = new Map(
    ((summary ?? []) as WarehouseStockSummaryRow[]).map((s) => [s.warehouse_id, s]),
  );

  return (warehouses ?? []).map((w) => {
    const s = summaryById.get(w.id);
    const skuCount = s?.sku_count ?? 0;
    const stockValue = Number(s?.stock_value ?? 0);
    const totalUnits = s?.total_units ?? 0;
    const utilizationPct = w.capacity ? Math.min(100, Math.round((totalUnits / w.capacity) * 100)) : 0;
    const manager = w.profiles as unknown as { first_name: string; last_name: string } | null;
    return {
      id: w.id,
      name: w.name,
      address: w.address,
      country: w.country,
      state: w.state,
      phone: w.phone,
      status: w.status as "active" | "inactive",
      managerProfileId: w.manager_profile_id,
      managerName: manager ? `${manager.first_name} ${manager.last_name}` : null,
      capacity: w.capacity,
      skuCount,
      stockValue,
      utilizationPct,
    };
  });
}
