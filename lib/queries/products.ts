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
  isActive: boolean;
  category: string | null;
  warehouseId: string | null;
}

function mapProductRow(p: {
  id: string;
  sku: string;
  barcode: string | null;
  name: string;
  brand: string | null;
  emoji: string | null;
  image_url: string | null;
  sell_price: number;
  qty_on_hand: number;
  status: "in_stock" | "low_stock" | "out_of_stock";
  is_active: boolean;
  warehouse_id: string | null;
  categories: unknown;
}): ProductListRow {
  return {
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
    isActive: p.is_active,
    category: (p.categories as unknown as { name: string } | null)?.name ?? null,
    warehouseId: p.warehouse_id,
  };
}

const PRODUCT_LIST_SELECT =
  "id, sku, barcode, name, brand, emoji, image_url, sell_price, qty_on_hand, status, is_active, warehouse_id, categories(name)";

export async function getProducts(): Promise<ProductListRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("products")
    .select(PRODUCT_LIST_SELECT)
    .is("archived_at", null)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map(mapProductRow);
}

// Escapes a raw search term for safe use inside a quoted PostgREST `.or()`
// value — see lib/queries/search.ts for the full explanation of why this is
// necessary (unescaped commas/parens used to corrupt the filter grammar).
function escapeIlikeTerm(raw: string): string {
  return raw.trim().replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

export interface ProductsPageFilters {
  search?: string;
  categoryId?: string;
  warehouseId?: string;
  status?: "in_stock" | "low_stock" | "out_of_stock";
  active?: "active" | "inactive";
}

// Server-side searched + paginated product listing for the Products admin
// page — unlike getProducts() above (used by pickers that need the whole
// catalog in memory), this never loads more than one page of rows, and the
// search is index-backed (pg_trgm) rather than an in-browser full-catalog scan.
export async function getProductsPage(
  filters: ProductsPageFilters,
  page = 1,
  pageSize = 25,
): Promise<{ rows: ProductListRow[]; total: number }> {
  const supabase = await createClient();
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = supabase
    .from("products")
    .select(PRODUCT_LIST_SELECT, { count: "exact" })
    .is("archived_at", null)
    .order("created_at", { ascending: false });

  if (filters.search?.trim()) {
    const term = escapeIlikeTerm(filters.search);
    query = query.or(
      ["name", "sku", "barcode", "brand"].map((col) => `${col}.ilike."%${term}%"`).join(","),
    );
  }
  if (filters.categoryId) query = query.eq("category_id", filters.categoryId);
  if (filters.warehouseId) query = query.eq("warehouse_id", filters.warehouseId);
  if (filters.status) query = query.eq("status", filters.status);
  if (filters.active === "active") query = query.eq("is_active", true);
  if (filters.active === "inactive") query = query.eq("is_active", false);

  const { data, error, count } = await query.range(from, to);
  if (error) {
    console.error("[Inventra] getProductsPage failed:", error);
    throw new Error("Could not load products.");
  }
  return { rows: (data ?? []).map(mapProductRow), total: count ?? 0 };
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
  isActive: boolean;
  variants: { id: string; name: string; sku_suffix: string | null; qty_on_hand: number }[];
}

export async function getProductDetail(id: string): Promise<ProductDetail | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("products")
    .select(
      "id, sku, barcode, name, description, brand, emoji, image_url, unit, cost_price, sell_price, qty_on_hand, reorder_level, expiry_date, category_id, supplier_id, warehouse_id, is_active, categories(name), suppliers(name), warehouses(name), product_variants(id, name, sku_suffix, qty_on_hand)",
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
    isActive: data.is_active,
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
  const { data } = await supabase.from("warehouses").select("id, name").eq("status", "active").order("name");
  return data ?? [];
}

export async function getProductOptions() {
  const supabase = await createClient();
  const { data } = await supabase.from("products").select("id, name, sku").is("archived_at", null).order("name");
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
