import "server-only";
import { createClient } from "@/lib/supabase/server";

export type CashRegisterStatus = "open" | "closed";

export interface CashRegisterRow {
  id: string;
  warehouseId: string;
  warehouseName: string;
  businessDate: string;
  status: CashRegisterStatus;
  moneyAtHand: number;
  moneyInPurse: number;
  openingBalance: number;
  cashSales: number | null;
  otherCashIncome: number;
  cashExpenses: number;
  cashWithdrawals: number;
  expectedClosingBalance: number | null;
  actualCashCount: number | null;
  difference: number | null;
  notes: string | null;
  openedByName: string | null;
  openedAt: string;
  closedByName: string | null;
  closedAt: string | null;
}

function mapRow(r: Record<string, any>): CashRegisterRow {
  return {
    id: r.id,
    warehouseId: r.warehouse_id,
    warehouseName: r.warehouses?.name ?? "Branch",
    businessDate: r.business_date,
    status: r.status,
    moneyAtHand: Number(r.money_at_hand),
    moneyInPurse: Number(r.money_in_purse),
    openingBalance: Number(r.opening_balance),
    cashSales: r.cash_sales !== null ? Number(r.cash_sales) : null,
    otherCashIncome: Number(r.other_cash_income),
    cashExpenses: Number(r.cash_expenses),
    cashWithdrawals: Number(r.cash_withdrawals),
    expectedClosingBalance: r.expected_closing_balance !== null ? Number(r.expected_closing_balance) : null,
    actualCashCount: r.actual_cash_count !== null ? Number(r.actual_cash_count) : null,
    difference: r.difference !== null ? Number(r.difference) : null,
    notes: r.notes,
    openedByName: r.opened_by_profile ? `${r.opened_by_profile.first_name} ${r.opened_by_profile.last_name}` : null,
    openedAt: r.opened_at,
    closedByName: r.closed_by_profile ? `${r.closed_by_profile.first_name} ${r.closed_by_profile.last_name}` : null,
    closedAt: r.closed_at,
  };
}

const SELECT_COLUMNS =
  "id, warehouse_id, business_date, status, money_at_hand, money_in_purse, opening_balance, cash_sales, other_cash_income, cash_expenses, cash_withdrawals, expected_closing_balance, actual_cash_count, difference, notes, opened_at, closed_at, warehouses(name), opened_by_profile:opened_by(first_name, last_name), closed_by_profile:closed_by(first_name, last_name)";

function todayBusinessDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function nextDate(dateStr: string): string {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

export interface TodaysCashRegister {
  register: CashRegisterRow | null;
  cashSalesSoFar: number;
  totalSalesSoFar: number;
}

// Live figures (cashSalesSoFar/totalSalesSoFar) are only meaningful
// while status='open' — once closed, register.cashSales holds the
// frozen snapshot instead. Computed the same way
// lib/actions/cash-register.ts's closeCashRegister does, so the Close
// Day preview and the actual close never disagree.
export async function getTodaysCashRegister(warehouseId: string): Promise<TodaysCashRegister> {
  const supabase = await createClient();
  const businessDate = todayBusinessDate();

  const { data, error } = await supabase
    .from("daily_cash_registers")
    .select(SELECT_COLUMNS)
    .eq("warehouse_id", warehouseId)
    .eq("business_date", businessDate)
    .maybeSingle();
  if (error) {
    console.error("[Inventra] getTodaysCashRegister failed:", error);
    throw new Error("Could not load today's cash register.");
  }

  const register = data ? mapRow(data) : null;
  if (!register || register.status !== "open") {
    return { register, cashSalesSoFar: register?.cashSales ?? 0, totalSalesSoFar: 0 };
  }

  const { data: sales } = await supabase
    .from("sales")
    .select("id, total")
    .eq("warehouse_id", warehouseId)
    .gte("created_at", businessDate)
    .lt("created_at", nextDate(businessDate));
  const rows = sales ?? [];
  const totalSalesSoFar = rows.reduce((sum, s) => sum + Number(s.total), 0);

  let cashSalesSoFar = 0;
  if (rows.length > 0) {
    const { data: payments } = await supabase
      .from("sale_payments")
      .select("amount")
      .eq("method", "cash")
      .in(
        "sale_id",
        rows.map((s) => s.id),
      );
    cashSalesSoFar = (payments ?? []).reduce((sum, p) => sum + Number(p.amount), 0);
  }

  return { register, cashSalesSoFar, totalSalesSoFar };
}

export async function getCashRegisterHistory(warehouseId: string, from: string, to: string): Promise<CashRegisterRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("daily_cash_registers")
    .select(SELECT_COLUMNS)
    .eq("warehouse_id", warehouseId)
    .gte("business_date", from)
    .lte("business_date", to)
    .order("business_date", { ascending: false })
    // Bounded by the caller's date range already (typically ~180 days, at
    // most one row per day) — this is a hard safety cap, not expected to
    // ever actually truncate real data.
    .limit(200);
  if (error) {
    console.error("[Inventra] getCashRegisterHistory failed:", error);
    throw new Error("Could not load cash register history.");
  }
  return (data ?? []).map(mapRow);
}
