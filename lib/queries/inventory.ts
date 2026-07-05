import "server-only";
import { createClient } from "@/lib/supabase/server";

export interface InventoryCard {
  label: string;
  value: number;
  sub: string;
  icon: string;
  bg: string;
}

export async function getInventoryCards(): Promise<InventoryCard[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("products")
    .select("qty_on_hand, qty_reserved, qty_damaged, qty_returned, expiry_date")
    .is("archived_at", null);
  if (error) throw error;

  const rows = data ?? [];
  const current = rows.reduce((s, r) => s + r.qty_on_hand, 0);
  const reserved = rows.reduce((s, r) => s + r.qty_reserved, 0);
  const damaged = rows.reduce((s, r) => s + r.qty_damaged, 0);
  const returned = rows.reduce((s, r) => s + r.qty_returned, 0);
  const in7 = new Date();
  in7.setDate(in7.getDate() + 7);
  const expiring = rows.filter((r) => r.expiry_date && new Date(r.expiry_date) <= in7).length;

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

// The adjustment log shows manual corrections only — adjustments and expiry
// write-offs — not the full ledger (sales, receipts, transfers, returns).
export async function getAdjustments(limit = 50): Promise<MovementRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("stock_movements")
    .select("id, type, qty_delta, reason, created_at, products(name), profiles(first_name, last_name)")
    .in("type", ["adjustment", "expired"])
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

export interface WarehouseOverview {
  id: string;
  name: string;
  address: string | null;
  managerName: string | null;
  skuCount: number;
  stockValue: number;
  utilizationPct: number;
}

export async function getWarehousesOverview(): Promise<WarehouseOverview[]> {
  const supabase = await createClient();
  const { data: warehouses, error } = await supabase
    .from("warehouses")
    .select("id, name, address, capacity, profiles(first_name, last_name)")
    .order("name");
  if (error) throw error;

  const { data: products } = await supabase
    .from("products")
    .select("warehouse_id, qty_on_hand, sell_price")
    .is("archived_at", null);

  return (warehouses ?? []).map((w) => {
    const inWarehouse = (products ?? []).filter((p) => p.warehouse_id === w.id);
    const skuCount = inWarehouse.length;
    const stockValue = inWarehouse.reduce((s, p) => s + p.qty_on_hand * Number(p.sell_price), 0);
    const totalUnits = inWarehouse.reduce((s, p) => s + p.qty_on_hand, 0);
    const utilizationPct = w.capacity ? Math.min(100, Math.round((totalUnits / w.capacity) * 100)) : 0;
    const manager = w.profiles as unknown as { first_name: string; last_name: string } | null;
    return {
      id: w.id,
      name: w.name,
      address: w.address,
      managerName: manager ? `${manager.first_name} ${manager.last_name}` : null,
      skuCount,
      stockValue,
      utilizationPct,
    };
  });
}
