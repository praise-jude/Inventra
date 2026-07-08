import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { PaymentMethod } from "@/lib/supabase/database.types";

export interface SaleListRow {
  id: string;
  customerName: string;
  warehouseId: string | null;
  warehouseName: string | null;
  total: number;
  paymentSummary: string;
  itemCount: number;
  createdAt: string;
}

const PAYMENT_LABEL: Record<PaymentMethod, string> = {
  cash: "Cash",
  card: "Card",
  bank_transfer: "Bank Transfer",
  mobile_money: "Mobile Money",
};

export async function getSalesList(warehouseId?: string): Promise<SaleListRow[]> {
  const supabase = await createClient();
  let query = supabase
    .from("sales")
    .select("id, walk_in_name, total, created_at, warehouse_id, customers(name), warehouses(name)")
    .order("created_at", { ascending: false })
    .limit(100);
  if (warehouseId) query = query.eq("warehouse_id", warehouseId);
  const { data: sales, error } = await query;
  if (error) {
    console.error("[Inventra] getSalesList (sales) failed:", error.message, error.details, error.hint, error.code);
    throw new Error("Could not load sales.");
  }

  const saleIds = (sales ?? []).map((s) => s.id);
  if (saleIds.length === 0) return [];

  const [{ data: payments, error: payError }, { data: items, error: itemError }] = await Promise.all([
    supabase.from("sale_payments").select("sale_id, method").in("sale_id", saleIds),
    supabase.from("stock_movements").select("sale_id").in("sale_id", saleIds),
  ]);
  if (payError) {
    console.error("[Inventra] getSalesList (payments) failed:", payError.message, payError.details, payError.hint, payError.code);
    throw new Error("Could not load sales.");
  }
  if (itemError) {
    console.error("[Inventra] getSalesList (items) failed:", itemError.message, itemError.details, itemError.hint, itemError.code);
    throw new Error("Could not load sales.");
  }

  const methodsBySale = new Map<string, PaymentMethod[]>();
  for (const p of payments ?? []) {
    methodsBySale.set(p.sale_id, [...(methodsBySale.get(p.sale_id) ?? []), p.method]);
  }
  const itemCountBySale = new Map<string, number>();
  for (const i of items ?? []) {
    if (!i.sale_id) continue;
    itemCountBySale.set(i.sale_id, (itemCountBySale.get(i.sale_id) ?? 0) + 1);
  }

  return (sales ?? []).map((s) => {
    const methods = methodsBySale.get(s.id) ?? [];
    const paymentSummary =
      methods.length === 0 ? "—" : methods.length === 1 ? PAYMENT_LABEL[methods[0]] : `Split (${methods.length})`;
    return {
      id: s.id,
      customerName: (s.customers as unknown as { name: string } | null)?.name ?? s.walk_in_name ?? "Walk-in customer",
      warehouseId: s.warehouse_id,
      warehouseName: (s.warehouses as unknown as { name: string } | null)?.name ?? null,
      total: Number(s.total),
      paymentSummary,
      itemCount: itemCountBySale.get(s.id) ?? 0,
      createdAt: s.created_at,
    };
  });
}

export interface SaleLineItem {
  id: string;
  productName: string;
  qty: number;
  unitPrice: number;
  lineTotal: number;
}

export interface SalePaymentRow {
  method: PaymentMethod;
  amount: number;
}

export interface SaleDetail {
  id: string;
  customerId: string | null;
  customerName: string;
  walkInName: string | null;
  subtotal: number;
  discountAmount: number;
  taxAmount: number;
  total: number;
  notes: string | null;
  createdAt: string;
  items: SaleLineItem[];
  payments: SalePaymentRow[];
}

export async function getSaleDetail(id: string): Promise<SaleDetail | null> {
  const supabase = await createClient();
  const { data: sale, error: saleError } = await supabase
    .from("sales")
    .select(
      "id, customer_id, walk_in_name, subtotal, discount_amount, tax_amount, total, notes, created_at, customers(name)",
    )
    .eq("id", id)
    .single();
  if (saleError || !sale) return null;

  const [{ data: items, error: itemError }, { data: payments, error: payError }] = await Promise.all([
    supabase.from("stock_movements").select("id, qty_delta, unit_price, products(name)").eq("sale_id", id),
    supabase.from("sale_payments").select("method, amount").eq("sale_id", id),
  ]);
  if (itemError) {
    console.error("[Inventra] getSaleDetail (items) failed:", itemError.message, itemError.details, itemError.hint, itemError.code);
    throw new Error("Could not load this sale's line items.");
  }
  if (payError) {
    console.error("[Inventra] getSaleDetail (payments) failed:", payError.message, payError.details, payError.hint, payError.code);
    throw new Error("Could not load this sale's payments.");
  }

  return {
    id: sale.id,
    customerId: sale.customer_id,
    customerName: (sale.customers as unknown as { name: string } | null)?.name ?? sale.walk_in_name ?? "Walk-in customer",
    walkInName: sale.walk_in_name,
    subtotal: Number(sale.subtotal),
    discountAmount: Number(sale.discount_amount),
    taxAmount: Number(sale.tax_amount),
    total: Number(sale.total),
    notes: sale.notes,
    createdAt: sale.created_at,
    items: (items ?? []).map((i) => {
      const qty = Math.abs(i.qty_delta);
      const unitPrice = Number(i.unit_price ?? 0);
      return {
        id: i.id,
        productName: (i.products as unknown as { name: string } | null)?.name ?? "—",
        qty,
        unitPrice,
        lineTotal: qty * unitPrice,
      };
    }),
    payments: (payments ?? []).map((p) => ({ method: p.method, amount: Number(p.amount) })),
  };
}
