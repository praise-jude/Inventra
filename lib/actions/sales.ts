"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { logAudit } from "@/lib/actions/audit";
import { requirePermission } from "@/lib/permissions";
import { getSaleDetail, type SaleDetail } from "@/lib/queries/sales";

async function requireSalesOrgId() {
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
  if (profile.role === "warehouse") throw new Error("Warehouse accounts can't record sales.");
  return {
    supabase,
    orgId: profile.org_id as string,
    userId: user.id,
    role: profile.role as string,
    actorName: `${profile.first_name} ${profile.last_name}`,
  };
}

export async function fetchSaleDetail(id: string): Promise<SaleDetail | null> {
  return getSaleDetail(id);
}

export interface SaleLineInput {
  productId: string;
  qty: number;
  discountPct: number;
}

export interface RecordSaleInput {
  customerId?: string;
  warehouseId?: string;
  items: SaleLineInput[];
  paymentMethod: string;
  notes?: string;
}

export async function recordSale(input: RecordSaleInput) {
  const { supabase, orgId, userId, role, actorName } = await requireSalesOrgId();
  await requirePermission(supabase, "sales", "create");

  if (input.items.length === 0) throw new Error("Add at least one product to the sale.");
  for (const item of input.items) {
    if (item.qty <= 0) throw new Error("Quantity must be greater than zero.");
    if (item.discountPct < 0 || item.discountPct > 100) throw new Error("Discount must be between 0 and 100%.");
  }

  const productIds = input.items.map((i) => i.productId);
  const [{ data: products, error: prodError }, { data: org, error: orgError }] = await Promise.all([
    supabase.from("products").select("id, name, sell_price, qty_on_hand, warehouse_id, is_active").in("id", productIds),
    supabase.from("organizations").select("tax_rate").eq("id", orgId).single(),
  ]);
  if (prodError || !products) throw new Error("Could not load the selected products.");
  if (orgError || !org) throw new Error("Could not load tax settings.");

  const productById = new Map(products.map((p) => [p.id, p]));

  let subtotal = 0;
  let discountAmount = 0;
  const lines: { productId: string; qty: number; warehouseId: string | null; unitPrice: number }[] = [];

  for (const item of input.items) {
    const product = productById.get(item.productId);
    if (!product) throw new Error("One of the selected products no longer exists.");
    if (!product.is_active) throw new Error(`"${product.name}" is inactive and can't be sold — reactivate it first.`);
    if (item.qty > product.qty_on_hand) {
      throw new Error(`Only ${product.qty_on_hand} of "${product.name}" in stock.`);
    }
    const lineSubtotal = Number(product.sell_price) * item.qty;
    const lineDiscount = lineSubtotal * (item.discountPct / 100);
    const lineTotal = lineSubtotal - lineDiscount;
    subtotal += lineSubtotal;
    discountAmount += lineDiscount;
    lines.push({
      productId: item.productId,
      qty: item.qty,
      warehouseId: product.warehouse_id,
      unitPrice: item.qty > 0 ? lineTotal / item.qty : 0,
    });
  }

  const taxableAmount = subtotal - discountAmount;
  const taxAmount = taxableAmount * (Number(org.tax_rate) / 100);
  const total = taxableAmount + taxAmount;
  if (total <= 0) throw new Error("Sale total must be greater than zero.");

  const { data: sale, error: saleError } = await supabase
    .from("sales")
    .insert({
      org_id: orgId,
      customer_id: input.customerId || null,
      warehouse_id: input.warehouseId || null,
      subtotal,
      discount_amount: discountAmount,
      tax_amount: taxAmount,
      total,
      notes: input.notes?.trim() || null,
      created_by: userId,
    })
    .select("id")
    .single();
  if (saleError || !sale) {
    console.error("[Inventra] recordSale (sales insert) failed:", saleError);
    throw new Error("Could not record the sale.");
  }

  const { error: payError } = await supabase
    .from("sale_payments")
    .insert({ org_id: orgId, sale_id: sale.id, method: input.paymentMethod, amount: total });
  if (payError) {
    console.error("[Inventra] recordSale (payment insert) failed:", payError);
    throw new Error("Could not record the sale's payment.");
  }

  const { error: movementError } = await supabase.from("stock_movements").insert(
    lines.map((l) => ({
      org_id: orgId,
      product_id: l.productId,
      warehouse_id: l.warehouseId,
      type: "sale",
      qty_delta: -l.qty,
      unit_price: l.unitPrice,
      sale_id: sale.id,
      created_by: userId,
    })),
  );
  if (movementError) {
    console.error("[Inventra] recordSale (stock_movements insert) failed:", movementError);
    throw new Error("Could not update stock for this sale.");
  }

  revalidatePath("/sales");
  revalidatePath("/dashboard");
  revalidatePath("/products");
  revalidatePath("/inventory");

  await logAudit({
    orgId,
    actorId: userId,
    actorName,
    actorRole: role,
    action: "sale.created",
    module: "Sales",
    entityType: "sale",
    entityId: sale.id as string,
    entityLabel: `Sale of ${lines.length} item${lines.length === 1 ? "" : "s"} — ${total.toFixed(2)}`,
    newValue: { total, subtotal, discountAmount, taxAmount, itemCount: lines.length, paymentMethod: input.paymentMethod },
    branchId: input.warehouseId || null,
  });

  return sale.id as string;
}

export interface UpdateSaleInput {
  customerId?: string;
  notes?: string;
  paymentMethod?: string;
}

export async function updateSale(id: string, input: UpdateSaleInput) {
  const { supabase, orgId, userId, role, actorName } = await requireSalesOrgId();
  await requirePermission(supabase, "sales", "edit");

  // customerId is only touched when the caller explicitly sends it — the
  // Sales UI no longer collects a customer at all, so leaving it undefined
  // must preserve whatever the sale already had rather than blanking it out.
  const updatePayload: Record<string, unknown> = {
    notes: input.notes?.trim() || null,
  };
  if (input.customerId !== undefined) {
    updatePayload.customer_id = input.customerId || null;
    if (input.customerId) updatePayload.walk_in_name = null;
  }

  const { data: updated, error: saleError } = await supabase
    .from("sales")
    .update(updatePayload)
    .eq("id", id)
    .select("id")
    .maybeSingle();
  if (saleError) {
    console.error("[Inventra] updateSale (sales) failed:", saleError);
    throw new Error("Could not update the sale.");
  }
  if (!updated) throw new Error("Sale not found, or you don't have permission to edit it.");

  if (input.paymentMethod) {
    const { data: payments, error: payFetchError } = await supabase
      .from("sale_payments")
      .select("id")
      .eq("sale_id", id);
    if (payFetchError) {
      console.error("[Inventra] updateSale (payments fetch) failed:", payFetchError);
      throw new Error("Could not update the sale's payment method.");
    }
    if ((payments ?? []).length === 1) {
      const { error: payError } = await supabase
        .from("sale_payments")
        .update({ method: input.paymentMethod })
        .eq("id", payments![0].id);
      if (payError) {
        console.error("[Inventra] updateSale (payments update) failed:", payError);
        throw new Error("Could not update the sale's payment method.");
      }
    }
  }

  revalidatePath("/sales");

  await logAudit({
    orgId,
    actorId: userId,
    actorName,
    actorRole: role,
    action: "sale.updated",
    module: "Sales",
    entityType: "sale",
    entityId: id,
    entityLabel: `Sale ${id.slice(0, 8)}`,
    newValue: { customerId: input.customerId ?? null, paymentMethod: input.paymentMethod ?? null },
  });
}

export async function deleteSale(id: string) {
  const { supabase, orgId, userId, role, actorName } = await requireSalesOrgId();
  await requirePermission(supabase, "sales", "delete");

  const { data: sale, error: saleError } = await supabase.from("sales").select("id, total").eq("id", id).maybeSingle();
  if (saleError) {
    console.error("[Inventra] deleteSale (sale fetch) failed:", saleError);
    throw new Error("Could not load this sale.");
  }
  if (!sale) throw new Error("Sale not found.");

  // Deleting each stock_movements row fires the reverse_stock_movement
  // trigger, which restores qty_on_hand — no manual compensating entry
  // needed. The sales row delete then cascades to sale_payments.
  //
  // A DELETE that RLS silently filters to 0 rows returns no error at all —
  // if this role has sales:delete but not inventory:delete_movement
  // (independently configurable via role_permissions), the movements would
  // never get removed, but without this check the sale row would still be
  // deleted right after, permanently desyncing the stock ledger.
  const { count: movementCount } = await supabase
    .from("stock_movements")
    .select("id", { count: "exact", head: true })
    .eq("sale_id", id);
  if ((movementCount ?? 0) > 0) {
    const { data: deletedMovements, error: movementsError } = await supabase
      .from("stock_movements")
      .delete()
      .eq("sale_id", id)
      .select("id");
    if (movementsError) {
      console.error("[Inventra] deleteSale (stock_movements) failed:", movementsError);
      throw new Error("Could not reverse this sale's stock impact.");
    }
    if (!deletedMovements || deletedMovements.length === 0) {
      throw new Error("Could not reverse this sale's stock impact — you may be missing the permission needed to delete stock movements.");
    }
  }

  const { error: deleteError } = await supabase.from("sales").delete().eq("id", id);
  if (deleteError) {
    console.error("[Inventra] deleteSale (sales) failed:", deleteError);
    throw new Error("Could not delete the sale.");
  }

  revalidatePath("/sales");
  revalidatePath("/dashboard");
  revalidatePath("/products");

  await logAudit({
    orgId,
    actorId: userId,
    actorName,
    actorRole: role,
    action: "sale.voided",
    module: "Sales",
    entityType: "sale",
    entityId: id,
    entityLabel: `Sale ${id.slice(0, 8)}`,
    previousValue: { total: sale.total },
  });
}
