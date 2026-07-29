import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { CustomerInvoiceStatus } from "@/lib/supabase/database.types";

export interface InvoiceRow {
  id: string;
  invoiceNumber: string;
  customerName: string;
  status: CustomerInvoiceStatus;
  issueDate: string;
  dueDate: string | null;
  total: number;
}

export interface InvoicesPageFilters {
  search?: string;
  status?: CustomerInvoiceStatus;
}

export interface InvoicesOverview {
  totalOutstanding: number;
  totalPaid: number;
  overdueCount: number;
  invoiceCount: number;
  rows: InvoiceRow[];
  total: number;
}

const OUTSTANDING_STATUSES: CustomerInvoiceStatus[] = ["sent", "overdue"];

// Was an unbounded `.select()` with no limit, same issue as
// getDebtorsOverview. Summary cards (Total Outstanding, overdue count,
// invoice count) come from a lightweight full-table scan of just
// status/total, independent of the paginated/filtered row list below —
// otherwise "Total Outstanding" would silently only reflect whatever
// page happens to be showing.
export async function getInvoicesOverview(
  filters: InvoicesPageFilters,
  page = 1,
  pageSize = 20,
): Promise<InvoicesOverview> {
  const supabase = await createClient();
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const { data: allForTotals, error: totalsError } = await supabase.from("customer_invoices").select("status, total");
  if (totalsError) {
    console.error("[Inventra] getInvoicesOverview (totals) failed:", totalsError);
    throw new Error("Could not load invoices.");
  }
  const totalsRows = allForTotals ?? [];
  const totalOutstanding = totalsRows
    .filter((r) => OUTSTANDING_STATUSES.includes(r.status as CustomerInvoiceStatus))
    .reduce((sum, r) => sum + Number(r.total), 0);
  const totalPaid = totalsRows.filter((r) => r.status === "paid").reduce((sum, r) => sum + Number(r.total), 0);
  const overdueCount = totalsRows.filter((r) => r.status === "overdue").length;

  let query = supabase
    .from("customer_invoices")
    .select("id, invoice_number, customer_name, status, issue_date, due_date, total", { count: "exact" })
    .order("created_at", { ascending: false });
  if (filters.search?.trim()) {
    const q = filters.search.trim().replace(/[%_]/g, "");
    query = query.or(`invoice_number.ilike.%${q}%,customer_name.ilike.%${q}%`);
  }
  if (filters.status) query = query.eq("status", filters.status);

  const { data, error, count } = await query.range(from, to);
  if (error) {
    console.error("[Inventra] getInvoicesOverview (page) failed:", error);
    throw new Error("Could not load invoices.");
  }

  return {
    totalOutstanding,
    totalPaid,
    overdueCount,
    invoiceCount: totalsRows.length,
    total: count ?? 0,
    rows: (data ?? []).map((r) => ({
      id: r.id,
      invoiceNumber: r.invoice_number,
      customerName: r.customer_name,
      status: r.status as CustomerInvoiceStatus,
      issueDate: r.issue_date,
      dueDate: r.due_date,
      total: Number(r.total),
    })),
  };
}

export interface InvoiceProductOption {
  id: string;
  name: string;
  sellPrice: number;
}

// Line items reference products for name/price prefill convenience only —
// creating an invoice never touches stock, so this is a plain lookup, not
// the qty-aware ProductListRow used by Sales.
export async function getInvoiceProductOptions(): Promise<InvoiceProductOption[]> {
  const supabase = await createClient();
  const { data } = await supabase.from("products").select("id, name, sell_price").is("archived_at", null).order("name");
  return (data ?? []).map((p) => ({ id: p.id, name: p.name, sellPrice: Number(p.sell_price) }));
}

export interface InvoiceItemRow {
  id: string;
  productId: string | null;
  description: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
}

export interface InvoiceDetail extends InvoiceRow {
  customerEmail: string | null;
  customerPhone: string | null;
  subtotal: number;
  discountAmount: number;
  taxAmount: number;
  notes: string | null;
  items: InvoiceItemRow[];
}

export async function getInvoiceDetail(id: string): Promise<InvoiceDetail | null> {
  const supabase = await createClient();
  const { data: invoice, error } = await supabase
    .from("customer_invoices")
    .select("id, invoice_number, customer_name, customer_email, customer_phone, status, issue_date, due_date, subtotal, discount_amount, tax_amount, total, notes")
    .eq("id", id)
    .single();
  if (error || !invoice) return null;

  const { data: items, error: itemsError } = await supabase
    .from("customer_invoice_items")
    .select("id, product_id, description, quantity, unit_price, line_total")
    .eq("invoice_id", id)
    .order("id");
  if (itemsError) {
    console.error("[Inventra] getInvoiceDetail (items) failed:", itemsError);
    throw new Error("Could not load this invoice's line items.");
  }

  return {
    id: invoice.id,
    invoiceNumber: invoice.invoice_number,
    customerName: invoice.customer_name,
    customerEmail: invoice.customer_email,
    customerPhone: invoice.customer_phone,
    status: invoice.status as CustomerInvoiceStatus,
    issueDate: invoice.issue_date,
    dueDate: invoice.due_date,
    subtotal: Number(invoice.subtotal),
    discountAmount: Number(invoice.discount_amount),
    taxAmount: Number(invoice.tax_amount),
    total: Number(invoice.total),
    notes: invoice.notes,
    items: (items ?? []).map((i) => ({
      id: i.id,
      productId: i.product_id,
      description: i.description,
      quantity: Number(i.quantity),
      unitPrice: Number(i.unit_price),
      lineTotal: Number(i.line_total),
    })),
  };
}
