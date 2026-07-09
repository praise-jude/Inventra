"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { logAudit } from "@/lib/actions/audit";
import type { AdjustmentType } from "@/lib/supabase/database.types";

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
