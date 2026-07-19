"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { logAudit } from "@/lib/actions/audit";
import { requirePermission } from "@/lib/permissions";
import { orIlike } from "@/lib/postgrest-filter";
import type { AdjustmentType } from "@/lib/supabase/database.types";

export interface ProductPickerRow {
  id: string;
  name: string;
  sku: string;
  qty: number;
}

// Debounced type-ahead search for pickers (e.g. Stock Adjustment) that need
// to find one product in a large catalog without ever loading the whole
// table into the browser — mirrors getProductsPage's ilike/index-backed
// search (lib/queries/products.ts) but returns only what a picker needs.
export async function searchProductsForPicker(query: string, limit = 20): Promise<ProductPickerRow[]> {
  const supabase = await createClient();
  const q = query.trim();
  if (!q) return [];

  const { data, error } = await supabase
    .from("products")
    .select("id, name, sku, qty_on_hand")
    .is("archived_at", null)
    .eq("is_active", true)
    .or(orIlike(["name", "sku", "barcode"], q))
    .order("name", { ascending: true })
    .limit(limit);
  if (error) {
    console.error("[Inventra] searchProductsForPicker failed:", error);
    throw new Error("Could not search products.");
  }
  return (data ?? []).map((p) => ({ id: p.id, name: p.name, sku: p.sku, qty: p.qty_on_hand }));
}

export interface CreateAdjustmentInput {
  productId: string;
  qtyDelta: number;
  reason: string;
  notes?: string;
  adjustmentType: AdjustmentType;
  // Expiry write-offs are their own movement type so the ledger stays honest.
  kind: "adjustment" | "expired";
}

export async function createAdjustment(input: CreateAdjustmentInput) {
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
  await requirePermission(supabase, "inventory", "create_movement");

  if (!input.productId) throw new Error("Pick a product.");
  if (!Number.isInteger(input.qtyDelta) || input.qtyDelta === 0) {
    throw new Error("Quantity must be a non-zero whole number.");
  }
  if (!input.reason.trim()) throw new Error("A reason is required for the audit trail.");

  const { data: product } = await supabase
    .from("products")
    .select("name, warehouse_id, qty_on_hand, warehouses(name)")
    .eq("id", input.productId)
    .single();
  if (!product) throw new Error("Product not found.");
  if (product.qty_on_hand + input.qtyDelta < 0) {
    throw new Error(`Stock can't go negative — only ${product.qty_on_hand} on hand.`);
  }

  const { error } = await supabase.from("stock_movements").insert({
    org_id: profile.org_id,
    product_id: input.productId,
    warehouse_id: product.warehouse_id,
    type: input.kind,
    qty_delta: input.qtyDelta,
    reason: input.reason.trim(),
    notes: input.notes?.trim() || null,
    adjustment_type: input.adjustmentType,
    created_by: user.id,
  });
  if (error) throw error;

  revalidatePath("/inventory/adjustments");
  revalidatePath("/inventory/movements");
  revalidatePath("/products");
  revalidatePath("/dashboard");

  const warehouseName = (product.warehouses as unknown as { name: string } | null)?.name ?? null;
  await logAudit({
    orgId: profile.org_id,
    actorId: user.id,
    actorName: `${profile.first_name} ${profile.last_name}`,
    actorRole: profile.role,
    action: "stock.adjusted",
    module: "Inventory",
    entityType: "product",
    entityId: input.productId,
    entityLabel: product.name,
    previousValue: { qtyOnHand: product.qty_on_hand },
    newValue: {
      qtyOnHand: product.qty_on_hand + input.qtyDelta,
      qtyDelta: input.qtyDelta,
      adjustmentType: input.adjustmentType,
      reason: input.reason.trim(),
      notes: input.notes?.trim() || null,
    },
    branchId: product.warehouse_id,
    branchName: warehouseName,
  });
}
