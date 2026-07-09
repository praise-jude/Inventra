import "server-only";
import { createClient } from "@/lib/supabase/server";
import { orIlike } from "@/lib/postgrest-filter";

export interface ProductSearchResult {
  id: string;
  name: string;
  sku: string;
  barcode: string | null;
  emoji: string | null;
  qtyOnHand: number;
  warehouseId: string | null;
  categoryName: string | null;
  warehouseName: string | null;
}

export interface SearchProductsOptions {
  activeOnly?: boolean;
  warehouseId?: string;
  limit?: number;
}

// Shared, trigram-index-backed product search — case-insensitive, partial
// match on name/SKU/barcode/brand, used by the Command Palette, the Sales
// product picker, and the Stock Adjustment product picker so there is one
// search implementation instead of several slightly-different ones.
export async function searchProductsForOrg(query: string, options: SearchProductsOptions = {}): Promise<ProductSearchResult[]> {
  const term = query.trim();
  if (!term) return [];

  const supabase = await createClient();
  let q = supabase
    .from("products")
    .select("id, name, sku, barcode, emoji, qty_on_hand, warehouse_id, categories(name), warehouses(name)")
    .is("archived_at", null)
    .or(orIlike(["name", "sku", "barcode", "brand"], term))
    .order("name")
    .limit(options.limit ?? 20);

  if (options.activeOnly) q = q.eq("is_active", true);
  if (options.warehouseId) q = q.eq("warehouse_id", options.warehouseId);

  const { data, error } = await q;
  if (error) {
    console.error("[Inventra] searchProductsForOrg failed:", error);
    throw new Error("Search failed — please try again.");
  }

  return (data ?? []).map((p) => ({
    id: p.id,
    name: p.name,
    sku: p.sku,
    barcode: p.barcode,
    emoji: p.emoji,
    qtyOnHand: p.qty_on_hand,
    warehouseId: p.warehouse_id,
    categoryName: (p.categories as unknown as { name: string } | null)?.name ?? null,
    warehouseName: (p.warehouses as unknown as { name: string } | null)?.name ?? null,
  }));
}
