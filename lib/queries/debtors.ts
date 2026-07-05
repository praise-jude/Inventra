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

export interface DebtorsOverview {
  totalOutstanding: number;
  totalPaid: number;
  overdueAmount: number;
  debtorCount: number;
  debtors: DebtorRow[];
}

export async function getDebtorsOverview(): Promise<DebtorsOverview> {
  const supabase = await createClient();
  const [{ data: debtors, error: debError }, { data: payments, error: payError }] = await Promise.all([
    supabase
      .from("debtors")
      .select("id, customer_name, phone, email, notes, amount_owed, due_date, status")
      .order("created_at", { ascending: false }),
    supabase.from("debtor_payments").select("amount"),
  ]);
  if (debError) {
    console.error("[Inventra] getDebtorsOverview (debtors) failed:", debError);
    throw new Error("Could not load debtors.");
  }
  if (payError) {
    console.error("[Inventra] getDebtorsOverview (payments) failed:", payError);
    throw new Error("Could not load debtors.");
  }

  const rows = (debtors ?? []).map((d) => ({ ...d, status: effectiveStatus(d.status, d.due_date) }));
  const totalOutstanding = rows.filter((d) => d.status !== "cancelled").reduce((s, d) => s + Number(d.amount_owed), 0);
  const overdueAmount = rows.filter((d) => d.status === "overdue").reduce((s, d) => s + Number(d.amount_owed), 0);
  const totalPaid = (payments ?? []).reduce((s, p) => s + Number(p.amount), 0);

  return {
    totalOutstanding,
    totalPaid,
    overdueAmount,
    debtorCount: rows.length,
    debtors: rows.map((d) => ({
      id: d.id,
      customerName: d.customer_name,
      phone: d.phone,
      email: d.email,
      notes: d.notes,
      amountOwed: Number(d.amount_owed),
      dueDate: d.due_date,
      status: d.status,
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
