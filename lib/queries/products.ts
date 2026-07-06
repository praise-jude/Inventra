import "server-only";
import { createClient } from "@/lib/supabase/server";

export interface ProductListRow {
  id: string;
  sku: string;
  barcode: string | null;
  name: string;
  brand: string | null;
  emoji: string | null;
  imageUrl: string | null;
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
    .select("id, sku, barcode, name, brand, emoji, image_url, sell_price, qty_on_hand, status, categories(name)")
    .is("archived_at", null)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((p) => ({
    id: p.id,
    sku: p.sku,
    barcode: p.barcode,
    name: p.name,
    brand: p.brand,
    emoji: p.emoji,
    imageUrl: p.image_url,
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
  barcode: string | null;
  name: string;
  description: string | null;
  brand: string | null;
  emoji: string | null;
  imageUrl: string | null;
  unit: string;
  cost_price: number;
  sell_price: number;
  qty_on_hand: number;
  reorder_level: number;
  expiry_date: string | null;
  categoryId: string | null;
  category: string | null;
  supplierId: string | null;
  supplier: string | null;
  warehouseId: string | null;
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
      "id, sku, barcode, name, description, brand, emoji, image_url, unit, cost_price, sell_price, qty_on_hand, reorder_level, expiry_date, category_id, supplier_id, warehouse_id, categories(name), suppliers(name), warehouses(name), product_variants(id, name, sku_suffix, qty_on_hand)",
    )
    .eq("id", id)
    .is("archived_at", null)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return {
    id: data.id,
    sku: data.sku,
    barcode: data.barcode,
    name: data.name,
    description: data.description,
    brand: data.brand,
    emoji: data.emoji,
    imageUrl: data.image_url,
    unit: data.unit,
    cost_price: Number(data.cost_price),
    sell_price: Number(data.sell_price),
    qty_on_hand: data.qty_on_hand,
    reorder_level: data.reorder_level,
    expiry_date: data.expiry_date,
    categoryId: data.category_id,
    category: (data.categories as unknown as { name: string } | null)?.name ?? null,
    supplierId: data.supplier_id,
    supplier: (data.suppliers as unknown as { name: string } | null)?.name ?? null,
    warehouseId: data.warehouse_id,
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

export interface ProductExportRow {
  name: string;
  sku: string;
  barcode: string | null;
  description: string | null;
  brand: string | null;
  category: string | null;
  supplier: string | null;
  warehouse: string | null;
  unit: string;
  cost_price: number;
  sell_price: number;
  reorder_level: number;
  qty_on_hand: number;
  expiry_date: string | null;
  image_url: string | null;
}

export async function getProductsForExport(): Promise<ProductExportRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("products")
    .select(
      "name, sku, barcode, description, brand, unit, cost_price, sell_price, reorder_level, qty_on_hand, expiry_date, image_url, categories(name), suppliers(name), warehouses(name)",
    )
    .is("archived_at", null)
    .order("name");
  if (error) throw error;
  return (data ?? []).map((p) => ({
    name: p.name,
    sku: p.sku,
    barcode: p.barcode,
    description: p.description,
    brand: p.brand,
    category: (p.categories as unknown as { name: string } | null)?.name ?? null,
    supplier: (p.suppliers as unknown as { name: string } | null)?.name ?? null,
    warehouse: (p.warehouses as unknown as { name: string } | null)?.name ?? null,
    unit: p.unit,
    cost_price: Number(p.cost_price),
    sell_price: Number(p.sell_price),
    reorder_level: p.reorder_level,
    qty_on_hand: p.qty_on_hand,
    expiry_date: p.expiry_date,
    image_url: p.image_url,
  }));
}

export async function findProductIdByCode(code: string): Promise<string | null> {
  const supabase = await createClient();
  const trimmed = code.trim();
  if (!trimmed) return null;

  const { data: byBarcode, error: barcodeError } = await supabase
    .from("products")
    .select("id")
    .eq("barcode", trimmed)
    .is("archived_at", null)
    .maybeSingle();
  if (barcodeError) throw barcodeError;
  if (byBarcode) return byBarcode.id;

  const { data: bySku, error: skuError } = await supabase
    .from("products")
    .select("id")
    .eq("sku", trimmed)
    .is("archived_at", null)
    .maybeSingle();
  if (skuError) throw skuError;
  return bySku?.id ?? null;
}
