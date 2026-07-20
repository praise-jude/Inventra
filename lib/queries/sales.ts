import "server-only";
import { createClient } from "@/lib/supabase/server";
import { escapeIlikeTerm } from "@/lib/postgrest-filter";
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

export interface SalesPageFilters {
  search?: string;
  warehouseId?: string;
  dateFrom?: string;
  dateTo?: string;
  paymentMethod?: PaymentMethod;
}

// Server-side searched + paginated sales listing, mirroring
// getProductsPage (lib/queries/products.ts) — the old getSalesList silently
// capped at the 100 most recent sales with no way to see older ones and no
// server-side search; this scales to the full sales history instead.
export async function getSalesPage(
  filters: SalesPageFilters,
  page = 1,
  pageSize = 20,
): Promise<{ rows: SaleListRow[]; total: number }> {
  const supabase = await createClient();
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = supabase
    .from("sales")
    .select("id, walk_in_name, total, created_at, warehouse_id, customers(name), warehouses(name)", { count: "exact" })
    .order("created_at", { ascending: false });

  if (filters.warehouseId) query = query.eq("warehouse_id", filters.warehouseId);
  if (filters.dateFrom) query = query.gte("created_at", filters.dateFrom);
  // Exclusive upper bound needs a day added since created_at is a
  // timestamp and dateTo arrives as a bare "YYYY-MM-DD" (midnight) — using
  // .lte() directly would silently exclude every sale made that day.
  if (filters.dateTo) {
    const nextDay = new Date(filters.dateTo);
    nextDay.setUTCDate(nextDay.getUTCDate() + 1);
    query = query.lt("created_at", nextDay.toISOString().slice(0, 10));
  }

  // sale_payments is a separate table (a split payment has several rows
  // per sale), so "sales paid via X" is resolved as its own id lookup
  // rather than a single-table filter.
  if (filters.paymentMethod) {
    const { data: matchingPayments } = await supabase.from("sale_payments").select("sale_id").eq("method", filters.paymentMethod);
    const saleIds = (matchingPayments ?? []).map((p) => p.sale_id);
    if (saleIds.length === 0) return { rows: [], total: 0 };
    query = query.in("id", saleIds);
  }

  const search = filters.search?.trim();
  if (search) {
    // No single PostgREST filter can match "walk-in name" OR "linked
    // customer's name" in one round trip, since the latter lives on a
    // joined table — resolve matching customer ids first (a small, org-
    // scoped table), then OR both conditions together.
    const escaped = escapeIlikeTerm(search);
    const { data: matchingCustomers } = await supabase.from("customers").select("id").ilike("name", `%${escaped}%`);
    const customerIds = (matchingCustomers ?? []).map((c) => c.id);
    const orParts = [`walk_in_name.ilike."%${escaped}%"`];
    if (customerIds.length > 0) orParts.push(`customer_id.in.(${customerIds.join(",")})`);
    query = query.or(orParts.join(","));
  }

  const { data: sales, error, count } = await query.range(from, to);
  if (error) {
    console.error("[Inventra] getSalesPage (sales) failed:", error.message, error.details, error.hint, error.code);
    throw new Error("Could not load sales.");
  }

  const saleIds = (sales ?? []).map((s) => s.id);
  if (saleIds.length === 0) return { rows: [], total: count ?? 0 };

  const [{ data: payments, error: payError }, { data: items, error: itemError }] = await Promise.all([
    supabase.from("sale_payments").select("sale_id, method").in("sale_id", saleIds),
    supabase.from("stock_movements").select("sale_id").in("sale_id", saleIds),
  ]);
  if (payError) {
    console.error("[Inventra] getSalesPage (payments) failed:", payError.message, payError.details, payError.hint, payError.code);
    throw new Error("Could not load sales.");
  }
  if (itemError) {
    console.error("[Inventra] getSalesPage (items) failed:", itemError.message, itemError.details, itemError.hint, itemError.code);
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

  const rows = (sales ?? []).map((s) => {
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

  return { rows, total: count ?? rows.length };
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
  receiptNumber: string;
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
  orgName: string;
  currency: string;
  branchName: string | null;
  branchAddress: string | null;
  cashierName: string | null;
  receiptFooter: string | null;
  paperSize: "58mm" | "80mm" | "a4";
  autoPrint: boolean;
}

export async function getSaleDetail(id: string): Promise<SaleDetail | null> {
  const supabase = await createClient();
  const { data: sale, error: saleError } = await supabase
    .from("sales")
    .select(
      "id, org_id, customer_id, walk_in_name, warehouse_id, subtotal, discount_amount, tax_amount, total, notes, created_at, created_by, customers(name), warehouses(name, address), profiles(first_name, last_name)",
    )
    .eq("id", id)
    .single();
  if (saleError || !sale) return null;

  const [{ data: items, error: itemError }, { data: payments, error: payError }, { data: org }, { data: printSettings }] =
    await Promise.all([
      supabase.from("stock_movements").select("id, qty_delta, unit_price, products(name)").eq("sale_id", id),
      supabase.from("sale_payments").select("method, amount").eq("sale_id", id),
      supabase.from("organizations").select("name, currency").eq("id", sale.org_id).single(),
      supabase.from("print_settings").select("paper_size, auto_print, receipt_footer").eq("org_id", sale.org_id).maybeSingle(),
    ]);
  if (itemError) {
    console.error("[Inventra] getSaleDetail (items) failed:", itemError.message, itemError.details, itemError.hint, itemError.code);
    throw new Error("Could not load this sale's line items.");
  }
  if (payError) {
    console.error("[Inventra] getSaleDetail (payments) failed:", payError.message, payError.details, payError.hint, payError.code);
    throw new Error("Could not load this sale's payments.");
  }

  const warehouse = sale.warehouses as unknown as { name: string; address: string | null } | null;
  const cashier = sale.profiles as unknown as { first_name: string; last_name: string } | null;

  return {
    id: sale.id,
    receiptNumber: `RCPT-${sale.id.slice(0, 8).toUpperCase()}`,
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
    orgName: org?.name ?? "",
    currency: org?.currency ?? "USD",
    branchName: warehouse?.name ?? null,
    branchAddress: warehouse?.address ?? null,
    cashierName: cashier ? `${cashier.first_name} ${cashier.last_name}` : null,
    receiptFooter: printSettings?.receipt_footer ?? null,
    paperSize: (printSettings?.paper_size as "58mm" | "80mm" | "a4" | undefined) ?? "80mm",
    autoPrint: printSettings?.auto_print ?? false,
  };
}
