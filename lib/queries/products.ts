import "server-only";
import { createClient } from "@/lib/supabase/server";

export interface ProductListRow {
  id: string;
  sku: string;
  name: string;
  brand: string | null;
  emoji: string | null;
  price: number;
  qty: number;
  status: "in_stock" | "low_stock" | "out_of_stock";
  category: string | null;
  category_id: string | null;
  warehouse_id: string | null;
}

export async function getProducts(): Promise<ProductListRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("products")
    .select("id, sku, name, brand, emoji, sell_price, qty_on_hand, status, category_id, warehouse_id, categories(name)")
    .is("archived_at", null)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((p) => ({
    id: p.id,
    sku: p.sku,
    name: p.name,
    brand: p.brand,
    emoji: p.emoji,
    price: Number(p.sell_price),
    qty: p.qty_on_hand,
    status: p.status,
    category: (p.categories as unknown as { name: string } | null)?.name ?? null,
    category_id: p.category_id,
    warehouse_id: p.warehouse_id,
  }));
}

export interface ProductDetail {
  id: string;
  sku: string;
  name: string;
  description: string | null;
  brand: string | null;
  emoji: string | null;
  unit: string;
  cost_price: number;
  sell_price: number;
  qty_on_hand: number;
  reorder_level: number;
  expiry_date: string | null;
  category: string | null;
  warehouse: string | null;
  category_id: string | null;
  warehouse_id: string | null;
  supplier_id: string | null;
  variants: { id: string; name: string; sku_suffix: string | null; qty_on_hand: number }[];
}

export async function getProductDetail(id: string): Promise<ProductDetail | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("products")
    .select(
      "id, sku, name, description, brand, emoji, unit, cost_price, sell_price, qty_on_hand, reorder_level, expiry_date, category_id, warehouse_id, supplier_id, categories(name), warehouses(name), product_variants(id, name, sku_suffix, qty_on_hand)",
    )
    .eq("id", id)
    .is("archived_at", null)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return {
    id: data.id,
    sku: data.sku,
    name: data.name,
    description: data.description,
    brand: data.brand,
    emoji: data.emoji,
    unit: data.unit,
    cost_price: Number(data.cost_price),
    sell_price: Number(data.sell_price),
    qty_on_hand: data.qty_on_hand,
    reorder_level: data.reorder_level,
    expiry_date: data.expiry_date,
    category: (data.categories as unknown as { name: string } | null)?.name ?? null,
    warehouse: (data.warehouses as unknown as { name: string } | null)?.name ?? null,
    category_id: data.category_id,
    warehouse_id: data.warehouse_id,
    supplier_id: data.supplier_id,
    variants: (data.product_variants as unknown as ProductDetail["variants"]) ?? [],
  };
}

export async function getCategories() {
  const supabase = await createClient();
  const { data } = await supabase.from("categories").select("id, name").order("name");
  return data ?? [];
}

export async function getWarehouseOptions() {
  const supabase = await createClient();
  const { data } = await supabase.from("warehouses").select("id, name").order("name");
  return data ?? [];
}

export async function getSupplierOptions() {
  const supabase = await createClient();
  const { data } = await supabase.from("suppliers").select("id, name").order("name");
  return data ?? [];
}
