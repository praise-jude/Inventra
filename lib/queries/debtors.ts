import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { DebtorStatus } from "@/lib/supabase/database.types";

// Nothing in the DB flips a debtor to 'overdue' when its due_date passes —
// derive it at read time so the KPI and badges stay honest without a cron.
function effectiveStatus(status: DebtorStatus, dueDate: string | null): DebtorStatus {
  if ((status === "pending" || status === "partially_paid") && dueDate && dueDate < new Date().toISOString().slice(0, 10)) {
    return "overdue";
  }
  return status;
}

export interface DebtorRow {
  id: string;
  customerName: string;
  phone: string | null;
  email: string | null;
  notes: string | null;
  amountOwed: number;
  dueDate: string | null;
  status: DebtorStatus;
}

export interface DebtorsPageFilters {
  search?: string;
  status?: DebtorStatus;
}

export interface DebtorsOverview {
  totalOutstanding: number;
  totalPaid: number;
  overdueAmount: number;
  debtorCount: number;
  rows: DebtorRow[];
  total: number;
}

// Was an unbounded `.select()` with no limit — fine while every org had a
// handful of debtors, not fine at real scale. Now server-paginated like
// getSalesPage/getAuditLogs. The summary cards (Total Outstanding, Overdue
// Amount, debtor count) still need to reflect *every* debtor, not just the
// current page, so they're computed from a separate lightweight scan
// (amount_owed/status/due_date only, not the full row) rather than derived
// from the paginated rows.
export async function getDebtorsOverview(
  filters: DebtorsPageFilters,
  page = 1,
  pageSize = 20,
): Promise<DebtorsOverview> {
  const supabase = await createClient();
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const [{ data: allForTotals, error: totalsError }, { data: totalPaidRaw, error: payError }] = await Promise.all([
    supabase.from("debtors").select("amount_owed, status, due_date"),
    supabase.rpc("get_debtor_payments_total"),
  ]);
  if (totalsError) {
    console.error("[Inventra] getDebtorsOverview (totals) failed:", totalsError);
    throw new Error("Could not load debtors.");
  }
  if (payError) {
    console.error("[Inventra] getDebtorsOverview (payments) failed:", payError);
    throw new Error("Could not load debtors.");
  }
  const withStatus = (allForTotals ?? []).map((d) => ({ ...d, status: effectiveStatus(d.status, d.due_date) }));
  const totalOutstanding = withStatus.filter((d) => d.status !== "cancelled").reduce((s, d) => s + Number(d.amount_owed), 0);
  const overdueAmount = withStatus.filter((d) => d.status === "overdue").reduce((s, d) => s + Number(d.amount_owed), 0);

  let query = supabase
    .from("debtors")
    .select("id, customer_name, phone, email, notes, amount_owed, due_date, status", { count: "exact" })
    .order("created_at", { ascending: false });
  if (filters.search?.trim()) {
    const q = filters.search.trim().replace(/[%_]/g, "");
    query = query.or(`customer_name.ilike.%${q}%,phone.ilike.%${q}%,email.ilike.%${q}%`);
  }
  if (filters.status === "overdue") {
    // "overdue" isn't a stored value — it's pending/partially_paid past
    // due_date, derived at read time (effectiveStatus above) so nothing
    // has to flip it via a cron. Matches that same rule as a query filter.
    const today = new Date().toISOString().slice(0, 10);
    query = query.in("status", ["pending", "partially_paid"]).lt("due_date", today);
  } else if (filters.status) {
    query = query.eq("status", filters.status);
  }

  const { data, error, count } = await query.range(from, to);
  if (error) {
    console.error("[Inventra] getDebtorsOverview (page) failed:", error);
    throw new Error("Could not load debtors.");
  }

  return {
    totalOutstanding,
    totalPaid: Number(totalPaidRaw ?? 0),
    overdueAmount,
    debtorCount: withStatus.length,
    total: count ?? 0,
    rows: (data ?? []).map((d) => ({
      id: d.id,
      customerName: d.customer_name,
      phone: d.phone,
      email: d.email,
      notes: d.notes,
      amountOwed: Number(d.amount_owed),
      dueDate: d.due_date,
      status: effectiveStatus(d.status, d.due_date),
    })),
  };
}

export interface DebtorPaymentRow {
  id: string;
  amount: number;
  paidAt: string;
  note: string | null;
}

export interface DebtorDetail extends DebtorRow {
  notes: string | null;
  payments: DebtorPaymentRow[];
}

export async function getDebtorDetail(id: string): Promise<DebtorDetail | null> {
  const supabase = await createClient();
  const { data: debtor, error: debError } = await supabase
    .from("debtors")
    .select("id, customer_name, phone, email, notes, amount_owed, due_date, status")
    .eq("id", id)
    .single();
  if (debError || !debtor) return null;

  const { data: payments, error: payError } = await supabase
    .from("debtor_payments")
    .select("id, amount, paid_at, note")
    .eq("debtor_id", id)
    .order("paid_at", { ascending: false });
  if (payError) {
    console.error("[Inventra] getDebtorDetail (payments) failed:", payError);
    throw new Error("Could not load this debtor's payment history.");
  }

  return {
    id: debtor.id,
    customerName: debtor.customer_name,
    phone: debtor.phone,
    email: debtor.email,
    notes: debtor.notes,
    amountOwed: Number(debtor.amount_owed),
    dueDate: debtor.due_date,
    status: effectiveStatus(debtor.status, debtor.due_date),
    payments: (payments ?? []).map((p) => ({ id: p.id, amount: Number(p.amount), paidAt: p.paid_at, note: p.note })),
  };
}
