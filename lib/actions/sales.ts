"use server";

import { revalidatePath } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { logAudit } from "@/lib/actions/audit";
import { requirePermission } from "@/lib/permissions";
import { createApprovalRequest, getApprovalSettings } from "@/lib/approval-service";
import { getSaleDetail, type SaleDetail } from "@/lib/queries/sales";

interface SalesCtx {
  supabase: SupabaseClient;
  orgId: string;
  userId: string;
  role: string;
  actorName: string;
}

async function requireSalesOrgId(): Promise<SalesCtx> {
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

interface ComputedSale {
  subtotal: number;
  discountAmount: number;
  taxAmount: number;
  total: number;
  maxDiscountPct: number;
  lines: { productId: string; qty: number; warehouseId: string | null; unitPrice: number }[];
}

async function computeSale(supabase: SupabaseClient, orgId: string, input: RecordSaleInput): Promise<ComputedSale> {
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
  let maxDiscountPct = 0;
  const lines: ComputedSale["lines"] = [];

  for (const item of input.items) {
    const product = productById.get(item.productId);
    if (!product) throw new Error("One of the selected products no longer exists.");
    if (!product.is_active) throw new Error(`"${product.name}" is inactive and can't be sold — reactivate it first.`);
    if (item.qty > product.qty_on_hand) {
      throw new Error(`Only ${product.qty_on_hand} of "${product.name}" in stock.`);
    }
    maxDiscountPct = Math.max(maxDiscountPct, item.discountPct);
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

  return { subtotal, discountAmount, taxAmount, total, maxDiscountPct, lines };
}

// The actual writes — shared by the immediate path (recordSale, no approval
// needed) and the approved-request path (approvals.ts, run with the
// approving manager's session but attributed to the original requester).
export async function performRecordSale(
  supabase: SupabaseClient,
  ctx: { orgId: string; userId: string; role: string; actorName: string },
  input: RecordSaleInput,
  computed: ComputedSale,
): Promise<string> {
  const { orgId, userId, role, actorName } = ctx;
  const { subtotal, discountAmount, taxAmount, total, lines } = computed;

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

export interface RecordSaleResult {
  status: "created" | "pending_approval";
  saleId?: string;
  approvalRequestId?: string;
}

export async function recordSale(input: RecordSaleInput): Promise<RecordSaleResult> {
  const ctx = await requireSalesOrgId();
  const { supabase, orgId, userId, role, actorName } = ctx;
  await requirePermission(supabase, "sales", "create");

  const computed = await computeSale(supabase, orgId, input);

  const settings = await getApprovalSettings(supabase, orgId);
  const needsApproval =
    !!settings?.discount_approval_enabled && computed.maxDiscountPct > Number(settings.discount_threshold_pct);

  if (needsApproval) {
    const requestId = await createApprovalRequest(supabase, {
      orgId,
      entityType: "discount",
      requestedBy: userId,
      payload: { input, computed },
      notifyTitle: "Discount needs approval",
      notifyBody: `${actorName} wants to apply a ${computed.maxDiscountPct}% discount on a sale of ${computed.total.toFixed(2)}.`,
    });
    return { status: "pending_approval", approvalRequestId: requestId };
  }

  const saleId = await performRecordSale(supabase, { orgId, userId, role, actorName }, input, computed);
  return { status: "created", saleId };
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

// The actual void — shared by the immediate path (deleteSale, no approval
// needed) and the approved-request path (approvals.ts).
export async function performDeleteSale(
  supabase: SupabaseClient,
  ctx: { orgId: string; userId: string; role: string; actorName: string },
  sale: { id: string; total: number },
): Promise<void> {
  const { orgId, userId, role, actorName } = ctx;

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
    .eq("sale_id", sale.id);
  if ((movementCount ?? 0) > 0) {
    const { data: deletedMovements, error: movementsError } = await supabase
      .from("stock_movements")
      .delete()
      .eq("sale_id", sale.id)
      .select("id");
    if (movementsError) {
      console.error("[Inventra] deleteSale (stock_movements) failed:", movementsError);
      throw new Error("Could not reverse this sale's stock impact.");
    }
    if (!deletedMovements || deletedMovements.length === 0) {
      throw new Error("Could not reverse this sale's stock impact — you may be missing the permission needed to delete stock movements.");
    }
  }

  const { error: deleteError } = await supabase.from("sales").delete().eq("id", sale.id);
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
    entityId: sale.id,
    entityLabel: `Sale ${sale.id.slice(0, 8)}`,
    previousValue: { total: sale.total },
  });
}

export interface DeleteSaleResult {
  status: "deleted" | "pending_approval";
  approvalRequestId?: string;
}

export async function deleteSale(id: string, reason?: string): Promise<DeleteSaleResult> {
  const ctx = await requireSalesOrgId();
  const { supabase, orgId, userId, role, actorName } = ctx;
  await requirePermission(supabase, "sales", "delete");

  const { data: sale, error: saleError } = await supabase.from("sales").select("id, total").eq("id", id).maybeSingle();
  if (saleError) {
    console.error("[Inventra] deleteSale (sale fetch) failed:", saleError);
    throw new Error("Could not load this sale.");
  }
  if (!sale) throw new Error("Sale not found.");

  // Owner/admin are always full-access (has_permission()'s own rule) — a
  // void threshold is meant to catch a manager's own void, not gate the
  // people who'd be the ones approving it anyway.
  const settings = await getApprovalSettings(supabase, orgId);
  const needsApproval =
    !!settings?.void_approval_enabled &&
    Number(sale.total) > Number(settings.void_threshold_amount) &&
    role !== "owner" &&
    role !== "admin";

  if (needsApproval) {
    const requestId = await createApprovalRequest(supabase, {
      orgId,
      entityType: "void_sale",
      entityId: id,
      requestedBy: userId,
      payload: { saleId: id, total: sale.total },
      reason,
      notifyTitle: "Void needs approval",
      notifyBody: `${actorName} wants to void a sale worth ${Number(sale.total).toFixed(2)}.`,
    });
    return { status: "pending_approval", approvalRequestId: requestId };
  }

  await performDeleteSale(supabase, { orgId, userId, role, actorName }, sale as { id: string; total: number });
  return { status: "deleted" };
}
