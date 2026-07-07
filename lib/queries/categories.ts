import "server-only";
import { createClient } from "@/lib/supabase/server";

export interface CategoryRow {
  id: string;
  name: string;
  emoji: string | null;
  productCount: number;
}

interface CategoryProductCountRow {
  category_id: string;
  count: number;
}

export async function getCategoriesDetailed(): Promise<CategoryRow[]> {
  const supabase = await createClient();
  const [{ data: categories, error: catError }, { data: counts, error: prodError }] = await Promise.all([
    supabase.from("categories").select("id, name, emoji").order("name"),
    supabase.rpc("get_category_product_counts"),
  ]);
  if (catError) {
    console.error("[Inventra] getCategoriesDetailed (categories) failed:", catError);
    throw new Error("Could not load categories.");
  }
  if (prodError) {
    console.error("[Inventra] getCategoriesDetailed (product counts) failed:", prodError);
    throw new Error("Could not load categories.");
  }

  const countsByCategory = new Map(
    ((counts ?? []) as CategoryProductCountRow[]).map((c) => [c.category_id, c.count]),
  );

  return (categories ?? []).map((c) => ({
    id: c.id,
    name: c.name,
    emoji: c.emoji,
    productCount: countsByCategory.get(c.id) ?? 0,
  }));
}
