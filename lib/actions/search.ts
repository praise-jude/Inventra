"use server";

import { searchProductsForOrg } from "@/lib/queries/search";

export interface PaletteProductResult {
  id: string;
  name: string;
  sku: string;
  emoji: string | null;
}

export async function searchProducts(query: string): Promise<PaletteProductResult[]> {
  const results = await searchProductsForOrg(query, { activeOnly: true, limit: 5 });
  return results.map((r) => ({ id: r.id, name: r.name, sku: r.sku, emoji: r.emoji }));
}
