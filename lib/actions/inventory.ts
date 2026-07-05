"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export interface CreateAdjustmentInput {
  productId: string;
  qtyDelta: number;
  reason: string;
  // Expiry write-offs are their own movement type so the ledger stays honest.
  kind: "adjustment" | "expired";
}

export async function createAdjustment(input: CreateAdjustmentInput) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data: profile } = await supabase.from("profiles").select("org_id").eq("id", user.id).single();
  if (!profile) throw new Error("No profile");

  if (!input.productId) throw new Error("Pick a product.");
  if (!Number.isInteger(input.qtyDelta) || input.qtyDelta === 0) {
    throw new Error("Quantity must be a non-zero whole number.");
  }
  if (!input.reason.trim()) throw new Error("A reason is required for the audit trail.");

  const { data: product } = await supabase
    .from("products")
    .select("warehouse_id, qty_on_hand")
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
    created_by: user.id,
  });
  if (error) throw error;

  revalidatePath("/inventory/adjustments");
  revalidatePath("/inventory/movements");
  revalidatePath("/products");
  revalidatePath("/dashboard");
}
