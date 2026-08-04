"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { isAdminRole, isManagerRole } from "@/lib/roles";
import { canManageBranches, canTransferProduct, UpgradeRequiredError } from "@/lib/entitlements";
import { logAudit } from "@/lib/actions/audit";
import { logError } from "@/lib/logger";
import { getProductsInWarehouse, type WarehouseProductOption } from "@/lib/queries/inventory";

export async function fetchProductsInWarehouse(warehouseId: string): Promise<WarehouseProductOption[]> {
  return getProductsInWarehouse(warehouseId);
}

// Branch/warehouse create/edit/archive/delete is owner/admin only —
// `warehouses_insert/update/delete` RLS already enforces this at the
// database layer, this just gives a clear error instead of a silent RLS
// no-op.
async function requireAdminOrgId() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  const { data: profile } = await supabase
    .from("profiles")
    .select("org_id, role, first_name, last_name")
    .eq("id", user.id)
    .single();
  if (!profile) throw new Error("No profile");
  if (!isAdminRole(profile.role)) {
    throw new Error("Only an owner or admin can manage branches.");
  }
  return {
    supabase,
    orgId: profile.org_id as string,
    userId: user.id,
    role: profile.role as string,
    actorName: `${profile.first_name} ${profile.last_name}`,
  };
}

// Transferring stock between branches is a day-to-day inventory operation,
// not branch administration — it stays manager-tier+, distinct from the
// admin-only gate above.
async function requireManagerOrgId() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  const { data: profile } = await supabase
    .from("profiles")
    .select("org_id, role, first_name, last_name")
    .eq("id", user.id)
    .single();
  if (!profile) throw new Error("No profile");
  if (!isManagerRole(profile.role)) {
    throw new Error("Only an owner, admin, or manager can transfer stock.");
  }
  return {
    supabase,
    orgId: profile.org_id as string,
    userId: user.id,
    role: profile.role as string,
    actorName: `${profile.first_name} ${profile.last_name}`,
  };
}

export interface WarehouseInput {
  name: string;
  address?: string;
  country?: string;
  state?: string;
  phone?: string;
  managerProfileId?: string;
  capacity?: number;
}

function normalize(input: WarehouseInput) {
  return {
    name: input.name.trim(),
    address: input.address?.trim() || null,
    country: input.country?.trim() || null,
    state: input.state?.trim() || null,
    phone: input.phone?.trim() || null,
    manager_profile_id: input.managerProfileId || null,
    capacity: input.capacity && input.capacity > 0 ? input.capacity : null,
  };
}

export async function createWarehouse(input: WarehouseInput) {
  const { supabase, orgId, userId, role, actorName } = await requireAdminOrgId();
  if (!(await canManageBranches())) throw new UpgradeRequiredError("Managing branches requires a Premium subscription.");
  const values = normalize(input);
  if (!values.name) throw new Error("Branch name is required.");

  const { data, error } = await supabase
    .from("warehouses")
    .insert({ org_id: orgId, ...values })
    .select("id, name")
    .single();
  if (error) {
    logError({ feature: "Branches", action: "createWarehouse" }, "branch insert failed", error);
    throw new Error("Could not create the branch.");
  }
  revalidatePath("/inventory/warehouses");
  revalidatePath("/settings/branches");
  revalidatePath("/products");

  await logAudit({
    orgId,
    actorId: userId,
    actorName,
    actorRole: role,
    action: "branch.created",
    module: "Branches",
    entityType: "warehouse",
    entityId: data.id,
    entityLabel: data.name,
    newValue: values,
    branchId: data.id,
    branchName: data.name,
  });

  return data;
}

export async function updateWarehouse(id: string, input: WarehouseInput) {
  const { supabase, orgId, userId, role, actorName } = await requireAdminOrgId();
  if (!(await canManageBranches())) throw new UpgradeRequiredError("Managing branches requires a Premium subscription.");
  const values = normalize(input);
  if (!values.name) throw new Error("Branch name is required.");

  const { data: before } = await supabase.from("warehouses").select("name, address, phone, capacity").eq("id", id).maybeSingle();

  const { error } = await supabase.from("warehouses").update(values).eq("id", id);
  if (error) {
    logError({ feature: "Branches", action: "updateWarehouse" }, "branch update failed", error);
    throw new Error("Could not update the branch.");
  }
  revalidatePath("/inventory/warehouses");
  revalidatePath("/settings/branches");
  revalidatePath("/products");

  await logAudit({
    orgId,
    actorId: userId,
    actorName,
    actorRole: role,
    action: "branch.updated",
    module: "Branches",
    entityType: "warehouse",
    entityId: id,
    entityLabel: values.name,
    previousValue: before,
    newValue: values,
    branchId: id,
    branchName: values.name,
  });
}

export async function archiveWarehouse(id: string) {
  const { supabase, orgId, userId, role, actorName } = await requireAdminOrgId();
  const { data: warehouse } = await supabase.from("warehouses").select("name").eq("id", id).maybeSingle();
  const { error } = await supabase.from("warehouses").update({ status: "inactive" }).eq("id", id);
  if (error) {
    logError({ feature: "Branches", action: "archiveWarehouse" }, "branch archive failed", error);
    throw new Error("Could not archive the branch.");
  }
  revalidatePath("/inventory/warehouses");
  revalidatePath("/settings/branches");
  revalidatePath("/products");

  await logAudit({
    orgId,
    actorId: userId,
    actorName,
    actorRole: role,
    action: "branch.updated",
    module: "Branches",
    entityType: "warehouse",
    entityId: id,
    entityLabel: warehouse?.name ?? id,
    previousValue: { status: "active" },
    newValue: { status: "inactive" },
    branchId: id,
    branchName: warehouse?.name ?? null,
  });
}

export async function reactivateWarehouse(id: string) {
  const { supabase, orgId, userId, role, actorName } = await requireAdminOrgId();
  const { data: warehouse } = await supabase.from("warehouses").select("name").eq("id", id).maybeSingle();
  const { error } = await supabase.from("warehouses").update({ status: "active" }).eq("id", id);
  if (error) {
    logError({ feature: "Branches", action: "reactivateWarehouse" }, "branch reactivate failed", error);
    throw new Error("Could not reactivate the branch.");
  }
  revalidatePath("/inventory/warehouses");
  revalidatePath("/settings/branches");
  revalidatePath("/products");

  await logAudit({
    orgId,
    actorId: userId,
    actorName,
    actorRole: role,
    action: "branch.updated",
    module: "Branches",
    entityType: "warehouse",
    entityId: id,
    entityLabel: warehouse?.name ?? id,
    previousValue: { status: "inactive" },
    newValue: { status: "active" },
    branchId: id,
    branchName: warehouse?.name ?? null,
  });
}

export async function deleteWarehouse(id: string) {
  const { supabase } = await requireAdminOrgId();

  const { count } = await supabase.from("products").select("id", { count: "exact", head: true }).eq("warehouse_id", id);
  if ((count ?? 0) > 0) {
    throw new Error(`${count} product${count === 1 ? "" : "s"} still assigned to this branch — reassign or transfer them first.`);
  }

  const { error } = await supabase.from("warehouses").delete().eq("id", id);
  if (error) {
    logError({ feature: "Branches", action: "deleteWarehouse" }, "branch delete failed", error);
    // 23503 = foreign_key_violation. Sales/stock_movements/customer_invoices/
    // debtors/expenses all reference warehouse_id now (branch-isolation
    // migrations) — the products-only precheck above can't catch those, so
    // this is the actual backstop rather than a fixed table list that would
    // drift every time a new table gets warehouse_id.
    if (error.code === "23503") {
      throw new Error("This branch has sales, stock, or expense history tied to it and can't be deleted — archive it instead.");
    }
    throw new Error("Could not delete the branch.");
  }
  revalidatePath("/inventory/warehouses");
  revalidatePath("/settings/branches");
  revalidatePath("/products");
}

export async function transferWarehouseStock(productId: string, toWarehouseId: string, reason?: string) {
  const { supabase, orgId, userId, role, actorName } = await requireManagerOrgId();
  if (!(await canTransferProduct())) throw new UpgradeRequiredError("Transferring stock between branches requires a Premium subscription.");

  const { data: product, error: productError } = await supabase
    .from("products")
    .select("id, name, warehouse_id, qty_on_hand")
    .eq("id", productId)
    .eq("org_id", orgId)
    .maybeSingle();
  if (productError) throw productError;
  if (!product) throw new Error("Product not found.");
  if (product.warehouse_id === toWarehouseId) throw new Error("Product is already in that warehouse.");

  const { data: toWarehouse } = await supabase.from("warehouses").select("name").eq("id", toWarehouseId).maybeSingle();

  const { error: updateError } = await supabase
    .from("products")
    .update({ warehouse_id: toWarehouseId })
    .eq("id", productId)
    .eq("org_id", orgId);
  if (updateError) {
    logError({ feature: "Inventory", action: "transferWarehouseStock" }, "product warehouse update failed", updateError);
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
    logError({ feature: "Inventory", action: "transferWarehouseStock" }, "movement insert failed", movementError);
    throw new Error("Product was moved, but the audit log entry could not be recorded.");
  }

  revalidatePath("/inventory/warehouses");
  revalidatePath("/inventory/movements");
  revalidatePath("/products");

  await logAudit({
    orgId,
    actorId: userId,
    actorName,
    actorRole: role,
    action: "stock.transferred",
    module: "Inventory",
    entityType: "product",
    entityId: productId,
    entityLabel: product.name,
    previousValue: { warehouseId: product.warehouse_id },
    newValue: { warehouseId: toWarehouseId, qty: product.qty_on_hand },
    branchId: toWarehouseId,
    branchName: toWarehouse?.name ?? null,
  });
}

// Branch signup codes — the self-service replacement for the old Team
// invite flow (see 20260803200000_branch_code_signup.sql). Whoever enters
// this code at signup joins this exact org/branch directly as 'manager',
// active, no approval step, so generating one is admin-only, same tier as
// the rest of branch administration above.
export interface BranchCodeResult {
  code: string;
}

export async function generateBranchCode(warehouseId: string): Promise<BranchCodeResult> {
  const { supabase, orgId, userId, role, actorName } = await requireAdminOrgId();

  const { data: warehouse } = await supabase.from("warehouses").select("name").eq("id", warehouseId).eq("org_id", orgId).maybeSingle();
  if (!warehouse) throw new Error("Branch not found.");

  const { data: codeData, error: codeError } = await supabase.rpc("generate_branch_code");
  if (codeError || !codeData) {
    logError({ feature: "Branches", action: "generateBranchCode" }, "generate_branch_code RPC failed", codeError);
    throw new Error("Could not generate a signup code.");
  }

  const { error } = await supabase.from("warehouses").update({ branch_code: codeData }).eq("id", warehouseId).eq("org_id", orgId);
  if (error) {
    logError({ feature: "Branches", action: "generateBranchCode" }, "branch_code update failed", error);
    throw new Error("Could not save the signup code.");
  }
  revalidatePath("/settings/branches");
  revalidatePath("/inventory/warehouses");

  void logAudit({
    orgId,
    actorId: userId,
    actorName,
    actorRole: role,
    action: "branch.updated",
    module: "Branches",
    entityType: "warehouse",
    entityId: warehouseId,
    entityLabel: warehouse.name,
    newValue: { branchCodeGenerated: true },
    branchId: warehouseId,
    branchName: warehouse.name,
  });

  return { code: codeData as string };
}

// Revokes a signup code (clears it) — the Owner/Admin's way to invalidate a
// leaked or no-longer-needed code, matching "expire only if the Owner
// chooses" (there's no automatic expiry by default; branch_code_expires_at
// stays null until explicitly set).
export async function revokeBranchCode(warehouseId: string): Promise<void> {
  const { supabase, orgId, userId, role, actorName } = await requireAdminOrgId();

  const { data: warehouse } = await supabase.from("warehouses").select("name").eq("id", warehouseId).eq("org_id", orgId).maybeSingle();
  if (!warehouse) throw new Error("Branch not found.");

  const { error } = await supabase
    .from("warehouses")
    .update({ branch_code: null, branch_code_expires_at: null })
    .eq("id", warehouseId)
    .eq("org_id", orgId);
  if (error) {
    logError({ feature: "Branches", action: "revokeBranchCode" }, "branch_code clear failed", error);
    throw new Error("Could not revoke the signup code.");
  }
  revalidatePath("/settings/branches");
  revalidatePath("/inventory/warehouses");

  void logAudit({
    orgId,
    actorId: userId,
    actorName,
    actorRole: role,
    action: "branch.updated",
    module: "Branches",
    entityType: "warehouse",
    entityId: warehouseId,
    entityLabel: warehouse.name,
    newValue: { branchCodeRevoked: true },
    branchId: warehouseId,
    branchName: warehouse.name,
  });
}
