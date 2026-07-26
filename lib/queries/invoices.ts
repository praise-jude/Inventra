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

export interface InvoicesOverview {
  totalOutstanding: number;
  totalPaid: number;
  overdueCount: number;
  invoiceCount: number;
  invoices: InvoiceRow[];
}

const OUTSTANDING_STATUSES: CustomerInvoiceStatus[] = ["sent", "overdue"];

export async function getInvoicesOverview(): Promise<InvoicesOverview> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("customer_invoices")
    .select("id, invoice_number, customer_name, status, issue_date, due_date, total")
    .order("created_at", { ascending: false });
  if (error) {
    console.error("[Inventra] getInvoicesOverview failed:", error);
    throw new Error("Could not load invoices.");
  }

  const rows = data ?? [];
  const totalOutstanding = rows
    .filter((r) => OUTSTANDING_STATUSES.includes(r.status as CustomerInvoiceStatus))
    .reduce((sum, r) => sum + Number(r.total), 0);
  const totalPaid = rows.filter((r) => r.status === "paid").reduce((sum, r) => sum + Number(r.total), 0);
  const overdueCount = rows.filter((r) => r.status === "overdue").length;

  return {
    totalOutstanding,
    totalPaid,
    overdueCount,
    invoiceCount: rows.length,
    invoices: rows.map((r) => ({
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
