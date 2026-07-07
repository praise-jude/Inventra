"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getProductsInWarehouse, type WarehouseProductOption } from "@/lib/queries/inventory";

export async function fetchProductsInWarehouse(warehouseId: string): Promise<WarehouseProductOption[]> {
  return getProductsInWarehouse(warehouseId);
}

// Mirrors lib/actions/suppliers.ts's requireManagerOrgId — warehouses are
// Manager-tier+ to create/edit; `warehouses_insert/update` RLS already
// enforces this at the database layer, this just gives a clear error
// instead of a silent RLS no-op.
async function requireManagerOrgId() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  const { data: profile } = await supabase.from("profiles").select("org_id, role").eq("id", user.id).single();
  if (!profile) throw new Error("No profile");
  if (!["owner", "admin", "manager"].includes(profile.role)) {
    throw new Error("Only an owner, admin, or manager can manage warehouses.");
  }
  return { supabase, orgId: profile.org_id as string, userId: user.id };
}

export interface WarehouseInput {
  name: string;
  address?: string;
  managerProfileId?: string;
  capacity?: number;
}

function normalize(input: WarehouseInput) {
  return {
    name: input.name.trim(),
    address: input.address?.trim() || null,
    manager_profile_id: input.managerProfileId || null,
    capacity: input.capacity && input.capacity > 0 ? input.capacity : null,
  };
}

export async function createWarehouse(input: WarehouseInput) {
  const { supabase, orgId } = await requireManagerOrgId();
  const values = normalize(input);
  if (!values.name) throw new Error("Warehouse name is required.");

  const { data, error } = await supabase
    .from("warehouses")
    .insert({ org_id: orgId, ...values })
    .select("id, name")
    .single();
  if (error) {
    console.error("[Inventra] createWarehouse failed:", error);
    throw new Error("Could not create the warehouse.");
  }
  revalidatePath("/inventory/warehouses");
  revalidatePath("/products");
  return data;
}

export async function updateWarehouse(id: string, input: WarehouseInput) {
  const { supabase } = await requireManagerOrgId();
  const values = normalize(input);
  if (!values.name) throw new Error("Warehouse name is required.");

  const { error } = await supabase.from("warehouses").update(values).eq("id", id);
  if (error) {
    console.error("[Inventra] updateWarehouse failed:", error);
    throw new Error("Could not update the warehouse.");
  }
  revalidatePath("/inventory/warehouses");
  revalidatePath("/products");
}

export async function deleteWarehouse(id: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  const { data: profile } = await supabase.from("profiles").select("org_id, role").eq("id", user.id).single();
  if (!profile) throw new Error("No profile");
  if (!["owner", "admin"].includes(profile.role)) {
    throw new Error("Only an owner or admin can delete a warehouse.");
  }

  const { count } = await supabase.from("products").select("id", { count: "exact", head: true }).eq("warehouse_id", id);
  if ((count ?? 0) > 0) {
    throw new Error(`${count} product${count === 1 ? "" : "s"} still assigned to this warehouse — reassign or transfer them first.`);
  }

  const { error } = await supabase.from("warehouses").delete().eq("id", id);
  if (error) {
    console.error("[Inventra] deleteWarehouse failed:", error);
    throw new Error("Could not delete the warehouse.");
  }
  revalidatePath("/inventory/warehouses");
  revalidatePath("/products");
}

export async function transferWarehouseStock(productId: string, toWarehouseId: string, reason?: string) {
  const { supabase, orgId, userId } = await requireManagerOrgId();

  const { data: product, error: productError } = await supabase
    .from("products")
    .select("id, warehouse_id, qty_on_hand")
    .eq("id", productId)
    .eq("org_id", orgId)
    .maybeSingle();
  if (productError) throw productError;
  if (!product) throw new Error("Product not found.");
  if (product.warehouse_id === toWarehouseId) throw new Error("Product is already in that warehouse.");

  const { error: updateError } = await supabase
    .from("products")
    .update({ warehouse_id: toWarehouseId })
    .eq("id", productId)
    .eq("org_id", orgId);
  if (updateError) {
    console.error("[Inventra] transferWarehouseStock (update) failed:", updateError);
    throw new Error("Could not transfer the product.");
  }

  const { error: movementError } = await supabase.from("stock_movements").insert({
    org_id: orgId,
    product_id: productId,
    warehouse_id: toWarehouseId,
    type: "transfer",
    qty_delta: 0,
    reason: reason?.trim() || `Transferred ${product.qty_on_hand} units to another warehouse`,
    created_by: userId,
  });
  if (movementError) {
    console.error("[Inventra] transferWarehouseStock (movement) failed:", movementError);
    throw new Error("Product was moved, but the audit log entry could not be recorded.");
  }

  revalidatePath("/inventory/warehouses");
  revalidatePath("/inventory/movements");
  revalidatePath("/products");
}
