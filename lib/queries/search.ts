import "server-only";
import { createClient } from "@/lib/supabase/server";

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

// Shared, typo-tolerant product search — backed by the search_products()
// RPC (pg_trgm word_similarity ranking across name/sku/barcode/brand/
// description/supplier name), used by the Command Palette, the Sales
// product picker, and the Stock Adjustment product picker so there is one
// search implementation instead of several slightly-different ones.
export async function searchProductsForOrg(query: string, options: SearchProductsOptions = {}): Promise<ProductSearchResult[]> {
  const term = query.trim();
  if (!term) return [];

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("search_products", {
    p_search: term,
    p_active: options.activeOnly ? true : null,
    p_warehouse_id: options.warehouseId || null,
    p_limit: options.limit ?? 20,
  });
  if (error) {
    console.error("[Inventra] searchProductsForOrg failed:", error);
    throw new Error("Search failed — please try again.");
  }

  const rows = (data ?? []) as unknown as {
    id: string;
    name: string;
    sku: string;
    barcode: string | null;
    emoji: string | null;
    qty_on_hand: number;
    warehouse_id: string | null;
    category_name: string | null;
    warehouse_name: string | null;
  }[];
  return rows.map((p) => ({
    id: p.id,
    name: p.name,
    sku: p.sku,
    barcode: p.barcode,
    emoji: p.emoji,
    qtyOnHand: p.qty_on_hand,
    warehouseId: p.warehouse_id,
    categoryName: p.category_name,
    warehouseName: p.warehouse_name,
  }));
}
