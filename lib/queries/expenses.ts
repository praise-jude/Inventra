import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { ExpenseCategory } from "@/lib/supabase/database.types";

export interface ExpenseRow {
  id: string;
  category: ExpenseCategory;
  description: string | null;
  amount: number;
  incurredAt: string;
}

export interface ExpensesOverview {
  dailyTotal: number;
  weeklyTotal: number;
  monthlyTotal: number;
  trend: { date: string; total: number }[];
  expenses: ExpenseRow[];
}

// Expenses.incurred_at is a plain `date` (no time component), so bucketing by
// day/week/month is timezone-agnostic except for determining what "today"
// actually is in the org's zone.
function dateKeyInTz(date: Date, timezone: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" }).format(
    date,
  );
}

const CATEGORY_LABEL: Record<ExpenseCategory, string> = {
  rent: "Rent",
  salary: "Salary",
  transport: "Transport",
  utilities: "Utilities",
  inventory_purchase: "Inventory Purchase",
  logistics: "Logistics",
  miscellaneous: "Miscellaneous",
};

export interface ExpenseCategoryBreakdown {
  category: ExpenseCategory;
  label: string;
  amount: number;
  pct: number;
}

export async function getExpenseCategoryBreakdown(timezone: string): Promise<ExpenseCategoryBreakdown[]> {
  const supabase = await createClient();
  const since = dateKeyInTz(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), timezone);

  const { data, error } = await supabase.from("expenses").select("category, amount").gte("incurred_at", since);
  if (error) {
    console.error("[Inventra] getExpenseCategoryBreakdown failed:", error);
    throw new Error("Could not load expense breakdown.");
  }

  const totals = new Map<ExpenseCategory, number>();
  let grandTotal = 0;
  for (const row of data ?? []) {
    const amount = Number(row.amount);
    totals.set(row.category, (totals.get(row.category) ?? 0) + amount);
    grandTotal += amount;
  }

  return Array.from(totals.entries())
    .map(([category, amount]) => ({
      category,
      label: CATEGORY_LABEL[category],
      amount,
      pct: grandTotal > 0 ? Math.round((amount / grandTotal) * 100) : 0,
    }))
    .sort((a, b) => b.amount - a.amount);
}

export async function getExpensesOverview(timezone: string): Promise<ExpensesOverview> {
  const supabase = await createClient();
  const since = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
  const sinceDate = dateKeyInTz(since, timezone);

  const { data, error } = await supabase
    .from("expenses")
    .select("id, category, description, amount, incurred_at")
    .gte("incurred_at", sinceDate)
    .order("incurred_at", { ascending: false });
  if (error) {
    console.error("[Inventra] getExpensesOverview failed:", error);
    throw new Error("Could not load expenses.");
  }

  const rows = data ?? [];
  const today = dateKeyInTz(new Date(), timezone);
  const weekAgo = dateKeyInTz(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), timezone);
  const monthAgo = dateKeyInTz(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), timezone);

  let dailyTotal = 0;
  let weeklyTotal = 0;
  let monthlyTotal = 0;
  const byDate = new Map<string, number>();
  for (const e of rows) {
    const amount = Number(e.amount);
    if (e.incurred_at === today) dailyTotal += amount;
    if (e.incurred_at >= weekAgo) weeklyTotal += amount;
    if (e.incurred_at >= monthAgo) monthlyTotal += amount;
    byDate.set(e.incurred_at, (byDate.get(e.incurred_at) ?? 0) + amount);
  }

  const trend = Array.from(byDate.entries())
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([date, total]) => ({ date, total }));

  return {
    dailyTotal,
    weeklyTotal,
    monthlyTotal,
    trend,
    expenses: rows.map((e) => ({
      id: e.id,
      category: e.category,
      description: e.description,
      amount: Number(e.amount),
      incurredAt: e.incurred_at,
    })),
  };
}
