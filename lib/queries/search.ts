import "server-only";
import { createClient } from "@/lib/supabase/server";

// PostgREST's `.or()` filter string uses `,` to separate conditions and `()`
// to group them — a raw user search term containing those characters used to
// corrupt the filter grammar (this was the root cause of "search returns
// nothing" for queries like "Widget (Blue)"). Wrapping each value in double
// quotes is PostgREST's own escape hatch for values containing filter
// metacharacters; only `\` and `"` need escaping once quoted.
function escapeIlikeTerm(raw: string): string {
  return raw.trim().replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function orIlike(columns: string[], term: string): string {
  const escaped = escapeIlikeTerm(term);
  return columns.map((col) => `${col}.ilike."%${escaped}%"`).join(",");
}

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
