import "server-only";
import { createClient } from "@/lib/supabase/server";

export interface CategoryRow {
  id: string;
  name: string;
  emoji: string | null;
  productCount: number;
}

export async function getCategoriesDetailed(): Promise<CategoryRow[]> {
  const supabase = await createClient();
  const [{ data: categories, error: catError }, { data: products, error: prodError }] = await Promise.all([
    supabase.from("categories").select("id, name, emoji").order("name"),
    supabase.from("products").select("category_id").is("archived_at", null),
  ]);
  if (catError) {
    console.error("[Inventra] getCategoriesDetailed (categories) failed:", catError);
    throw new Error("Could not load categories.");
  }
  if (prodError) {
    console.error("[Inventra] getCategoriesDetailed (products) failed:", prodError);
    throw new Error("Could not load categories.");
  }

  const counts = new Map<string, number>();
  for (const p of products ?? []) {
    if (!p.category_id) continue;
    counts.set(p.category_id, (counts.get(p.category_id) ?? 0) + 1);
  }

  return (categories ?? []).map((c) => ({
    id: c.id,
    name: c.name,
    emoji: c.emoji,
    productCount: counts.get(c.id) ?? 0,
  }));
}
