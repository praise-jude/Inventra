"use server";

import { createClient } from "@/lib/supabase/server";

export interface PaletteProductResult {
  id: string;
  name: string;
  sku: string;
  emoji: string | null;
}

export async function searchProducts(query: string): Promise<PaletteProductResult[]> {
  if (!query.trim()) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("products")
    .select("id, name, sku, emoji")
    .is("archived_at", null)
    .or(`name.ilike.%${query}%,sku.ilike.%${query}%`)
    .limit(5);
  return data ?? [];
}
