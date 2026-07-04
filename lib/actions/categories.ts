"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

// Categories/suppliers are Manager-tier+ to mutate (owner/admin/manager) —
// `categories_insert/update/delete` RLS already enforces this at the
// database layer; this check exists for a clear error instead of a silent
// RLS no-op.
async function requireManagerOrgId() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  const { data: profile } = await supabase.from("profiles").select("org_id, role").eq("id", user.id).single();
  if (!profile) throw new Error("No profile");
  if (!["owner", "admin", "manager"].includes(profile.role)) {
    throw new Error("Only an owner, admin, or manager can manage categories.");
  }
  return { supabase, orgId: profile.org_id as string };
}

export interface CategoryInput {
  name: string;
  emoji?: string;
}

export async function createCategory(input: CategoryInput) {
  const { supabase, orgId } = await requireManagerOrgId();
  const name = input.name.trim();
  if (!name) throw new Error("Category name is required.");

  const { error } = await supabase
    .from("categories")
    .insert({ org_id: orgId, name, emoji: input.emoji?.trim() || null });
  if (error) {
    if (error.code === "23505") throw new Error("A category with this name already exists.");
    console.error("[Inventra] createCategory failed:", error);
    throw new Error("Could not create the category.");
  }
  revalidatePath("/inventory/categories");
  revalidatePath("/products");
}

export async function updateCategory(id: string, input: CategoryInput) {
  const { supabase } = await requireManagerOrgId();
  const name = input.name.trim();
  if (!name) throw new Error("Category name is required.");

  const { error } = await supabase
    .from("categories")
    .update({ name, emoji: input.emoji?.trim() || null })
    .eq("id", id);
  if (error) {
    if (error.code === "23505") throw new Error("A category with this name already exists.");
    console.error("[Inventra] updateCategory failed:", error);
    throw new Error("Could not update the category.");
  }
  revalidatePath("/inventory/categories");
  revalidatePath("/products");
}

export async function deleteCategory(id: string) {
  const { supabase } = await requireManagerOrgId();

  const { count } = await supabase.from("products").select("id", { count: "exact", head: true }).eq("category_id", id);
  if ((count ?? 0) > 0) {
    throw new Error(`${count} product${count === 1 ? "" : "s"} still use this category — reassign them first.`);
  }

  const { error } = await supabase.from("categories").delete().eq("id", id);
  if (error) {
    console.error("[Inventra] deleteCategory failed:", error);
    throw new Error("Could not delete the category.");
  }
  revalidatePath("/inventory/categories");
  revalidatePath("/products");
}
