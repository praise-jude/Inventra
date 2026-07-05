"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getSupplierDetail, type SupplierDetail } from "@/lib/queries/suppliers";

export async function fetchSupplierDetail(id: string): Promise<SupplierDetail | null> {
  return getSupplierDetail(id);
}

// Mirrors lib/actions/categories.ts's requireManagerOrgId — suppliers are
// Manager-tier+ to mutate; `suppliers_insert/update/delete` RLS already
// enforces this at the database layer.
async function requireManagerOrgId() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  const { data: profile } = await supabase.from("profiles").select("org_id, role").eq("id", user.id).single();
  if (!profile) throw new Error("No profile");
  if (!["owner", "admin", "manager"].includes(profile.role)) {
    throw new Error("Only an owner, admin, or manager can manage suppliers.");
  }
  return { supabase, orgId: profile.org_id as string };
}

export interface SupplierInput {
  name: string;
  company?: string;
  contactPerson?: string;
  email?: string;
  phone?: string;
  address?: string;
}

function normalize(input: SupplierInput) {
  return {
    name: input.name.trim(),
    company: input.company?.trim() || null,
    contact_person: input.contactPerson?.trim() || null,
    email: input.email?.trim() || null,
    phone: input.phone?.trim() || null,
    address: input.address?.trim() || null,
  };
}

export async function createSupplier(input: SupplierInput) {
  const { supabase, orgId } = await requireManagerOrgId();
  const values = normalize(input);
  if (!values.name) throw new Error("Supplier name is required.");

  const { data, error } = await supabase
    .from("suppliers")
    .insert({ org_id: orgId, ...values })
    .select("id, name")
    .single();
  if (error) {
    console.error("[Inventra] createSupplier failed:", error);
    throw new Error("Could not create the supplier.");
  }
  revalidatePath("/inventory/suppliers");
  revalidatePath("/products");
  return data;
}

export async function updateSupplier(id: string, input: SupplierInput) {
  const { supabase } = await requireManagerOrgId();
  const values = normalize(input);
  if (!values.name) throw new Error("Supplier name is required.");

  const { error } = await supabase.from("suppliers").update(values).eq("id", id);
  if (error) {
    console.error("[Inventra] updateSupplier failed:", error);
    throw new Error("Could not update the supplier.");
  }
  revalidatePath("/inventory/suppliers");
  revalidatePath("/products");
}

export async function deleteSupplier(id: string) {
  const { supabase } = await requireManagerOrgId();

  const { count } = await supabase.from("products").select("id", { count: "exact", head: true }).eq("supplier_id", id);
  if ((count ?? 0) > 0) {
    throw new Error(`${count} product${count === 1 ? "" : "s"} still use this supplier — reassign them first.`);
  }

  const { error } = await supabase.from("suppliers").delete().eq("id", id);
  if (error) {
    console.error("[Inventra] deleteSupplier failed:", error);
    throw new Error("Could not delete the supplier.");
  }
  revalidatePath("/inventory/suppliers");
  revalidatePath("/products");
}
