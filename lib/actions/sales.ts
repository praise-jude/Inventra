"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getSaleDetail, type SaleDetail } from "@/lib/queries/sales";

async function requireSalesOrgId() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  const { data: profile } = await supabase.from("profiles").select("org_id, role").eq("id", user.id).single();
  if (!profile) throw new Error("No profile");
  if (profile.role === "warehouse") throw new Error("Warehouse accounts can't record sales.");
  return { supabase, orgId: profile.org_id as string, userId: user.id };
}

export async function fetchSaleDetail(id: string): Promise<SaleDetail | null> {
  return getSaleDetail(id);
}

export async function createCustomer(input: { name: string; phone?: string; email?: string }) {
  const { supabase, orgId } = await requireSalesOrgId();
  const name = input.name.trim();
  if (!name) throw new Error("Customer name is required.");

  const { data, error } = await supabase
    .from("customers")
    .insert({ org_id: orgId, name, phone: input.phone?.trim() || null, email: input.email?.trim() || null })
    .select("id, name, phone")
    .single();
  if (error) {
    console.error("[Inventra] createCustomer failed:", error);
    throw new Error("Could not create the customer.");
  }
  revalidatePath("/sales/new");
  return data;
}

export interface SaleLineInput {
  productId: string;
  qty: number;
  discountPct: number;
}

export interface RecordSaleInput {
  customerId?: string;
  walkInName?: string;
  items: SaleLineInput[];
  paymentMethod: string;
  notes?: string;
}

export async function recordSale(input: RecordSaleInput) {
  const { supabase, orgId, userId } = await requireSalesOrgId();

  if (input.items.length === 0) throw new Error("Add at least one product to the sale.");
  for (const item of input.items) {
    if (item.qty <= 0) throw new Error("Quantity must be greater than zero.");
    if (item.discountPct < 0 || item.discountPct > 100) throw new Error("Discount must be between 0 and 100%.");
  }

  const productIds = input.items.map((i) => i.productId);
  const [{ data: products, error: prodError }, { data: org, error: orgError }] = await Promise.all([
    supabase.from("products").select("id, name, sell_price, qty_on_hand, warehouse_id").in("id", productIds),
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
      walk_in_name: input.customerId ? null : input.walkInName?.trim() || null,
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
  return sale.id as string;
}
