"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { isAdminRole, isManagerRole } from "@/lib/roles";
import { logAudit } from "@/lib/actions/audit";
import { notifyApprovers } from "@/lib/notifications-service";

// Mirrors lib/actions/warehouses.ts's shape (local role-check +
// logAudit after every mutation) rather than expenses.ts's (which skips
// audit logging) — a cash register represents real money, worth the
// same audit trail branch management already gets.
async function requireManagerOrgId() {
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
  if (!isManagerRole(profile.role)) {
    throw new Error("Only an owner, admin, or manager can open or close the cash register.");
  }
  return {
    supabase,
    orgId: profile.org_id as string,
    userId: user.id,
    role: profile.role as string,
    actorName: `${profile.first_name} ${profile.last_name}`,
  };
}

async function requireAdminOrgId() {
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
  if (!isAdminRole(profile.role)) {
    throw new Error("Only an owner or admin can edit the opening balance.");
  }
  return {
    supabase,
    orgId: profile.org_id as string,
    userId: user.id,
    role: profile.role as string,
    actorName: `${profile.first_name} ${profile.last_name}`,
  };
}

// "Business date" bucketing matches how get_kpis()'s today_revenue/
// yesterday_revenue already work (created_at::date = current_date,
// server-timezone precision) rather than inventing new org-timezone
// conversion logic this app doesn't otherwise apply to timestamptz
// columns — sales.created_at is a full timestamptz, unlike
// expenses.incurred_at which is a plain date.
function todayBusinessDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function nextDate(dateStr: string): string {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

async function cashSalesSoFar(
  supabase: Awaited<ReturnType<typeof createClient>>,
  orgId: string,
  warehouseId: string,
  businessDate: string,
): Promise<{ cashSales: number; totalSales: number }> {
  const { data: sales } = await supabase
    .from("sales")
    .select("id, total")
    .eq("org_id", orgId)
    .eq("warehouse_id", warehouseId)
    .gte("created_at", businessDate)
    .lt("created_at", nextDate(businessDate));
  const rows = sales ?? [];
  const totalSales = rows.reduce((sum, s) => sum + Number(s.total), 0);
  if (rows.length === 0) return { cashSales: 0, totalSales: 0 };

  const { data: payments } = await supabase
    .from("sale_payments")
    .select("amount")
    .eq("method", "cash")
    .in(
      "sale_id",
      rows.map((s) => s.id),
    );
  const cashSales = (payments ?? []).reduce((sum, p) => sum + Number(p.amount), 0);
  return { cashSales, totalSales };
}

export interface OpenCashRegisterInput {
  warehouseId: string;
  moneyAtHand: number;
  moneyInPurse: number;
}

export async function openCashRegister(input: OpenCashRegisterInput): Promise<string> {
  const { supabase, orgId, userId, role, actorName } = await requireManagerOrgId();
  if (input.moneyAtHand < 0 || input.moneyInPurse < 0) throw new Error("Amounts can't be negative.");

  const { data: warehouse } = await supabase.from("warehouses").select("name").eq("id", input.warehouseId).maybeSingle();
  const businessDate = todayBusinessDate();
  const openingBalance = input.moneyAtHand + input.moneyInPurse;

  const { data, error } = await supabase
    .from("daily_cash_registers")
    .insert({
      org_id: orgId,
      warehouse_id: input.warehouseId,
      business_date: businessDate,
      money_at_hand: input.moneyAtHand,
      money_in_purse: input.moneyInPurse,
      opening_balance: openingBalance,
      opened_by: userId,
    })
    .select("id")
    .single();
  if (error) {
    console.error("[Inventra] openCashRegister failed:", error);
    if (error.code === "23505") throw new Error("The cash register for this branch is already open today.");
    throw new Error("Could not open the cash register.");
  }

  revalidatePath("/cash-register");
  revalidatePath("/dashboard");
  await logAudit({
    orgId,
    actorId: userId,
    actorName,
    actorRole: role,
    action: "cash_register.opened",
    module: "Cash Register",
    entityType: "daily_cash_register",
    entityId: data.id,
    entityLabel: `${warehouse?.name ?? "Branch"} — ${businessDate}`,
    newValue: { moneyAtHand: input.moneyAtHand, moneyInPurse: input.moneyInPurse, openingBalance },
    branchId: input.warehouseId,
    branchName: warehouse?.name ?? null,
  });

  return data.id as string;
}

export interface UpdateCashRegisterOpeningInput {
  moneyAtHand: number;
  moneyInPurse: number;
}

// Admin-only — stricter than open/close (Manager-tier), matching the
// spec: "Admin: can edit before closing."
export async function updateCashRegisterOpening(id: string, input: UpdateCashRegisterOpeningInput): Promise<void> {
  const { supabase, orgId, userId, role, actorName } = await requireAdminOrgId();
  if (input.moneyAtHand < 0 || input.moneyInPurse < 0) throw new Error("Amounts can't be negative.");

  const { data: before } = await supabase
    .from("daily_cash_registers")
    .select("status, money_at_hand, money_in_purse, warehouse_id, warehouses(name)")
    .eq("id", id)
    .maybeSingle();
  if (!before) throw new Error("Cash register entry not found.");
  if (before.status === "closed") throw new Error("This day is already closed and can't be edited.");

  const openingBalance = input.moneyAtHand + input.moneyInPurse;
  const { error } = await supabase
    .from("daily_cash_registers")
    .update({ money_at_hand: input.moneyAtHand, money_in_purse: input.moneyInPurse, opening_balance: openingBalance })
    .eq("id", id);
  if (error) {
    console.error("[Inventra] updateCashRegisterOpening failed:", error);
    throw new Error("Could not update the opening balance.");
  }

  revalidatePath("/cash-register");
  revalidatePath("/dashboard");
  const branchName = (before as unknown as { warehouses: { name: string } | null }).warehouses?.name ?? null;
  await logAudit({
    orgId,
    actorId: userId,
    actorName,
    actorRole: role,
    action: "cash_register.opening_edited",
    module: "Cash Register",
    entityType: "daily_cash_register",
    entityId: id,
    entityLabel: branchName ?? undefined,
    previousValue: { moneyAtHand: before.money_at_hand, moneyInPurse: before.money_in_purse },
    newValue: { moneyAtHand: input.moneyAtHand, moneyInPurse: input.moneyInPurse, openingBalance },
    branchId: before.warehouse_id,
    branchName,
  });
}

export interface CloseCashRegisterInput {
  otherCashIncome: number;
  cashExpenses: number;
  cashWithdrawals: number;
  actualCashCount: number;
  notes?: string;
}

export interface CloseCashRegisterResult {
  expectedClosingBalance: number;
  difference: number;
}

export async function closeCashRegister(id: string, input: CloseCashRegisterInput): Promise<CloseCashRegisterResult> {
  const { supabase, orgId, userId, role, actorName } = await requireManagerOrgId();
  if ([input.otherCashIncome, input.cashExpenses, input.cashWithdrawals, input.actualCashCount].some((n) => n < 0)) {
    throw new Error("Amounts can't be negative.");
  }

  const { data: register } = await supabase
    .from("daily_cash_registers")
    .select("status, opening_balance, warehouse_id, business_date, warehouses(name)")
    .eq("id", id)
    .maybeSingle();
  if (!register) throw new Error("Cash register entry not found.");
  if (register.status === "closed") throw new Error("This day is already closed.");

  const { cashSales } = await cashSalesSoFar(supabase, orgId, register.warehouse_id, register.business_date);
  const expectedClosingBalance =
    Number(register.opening_balance) + cashSales + input.otherCashIncome - input.cashExpenses - input.cashWithdrawals;
  const difference = input.actualCashCount - expectedClosingBalance;

  const { error } = await supabase
    .from("daily_cash_registers")
    .update({
      status: "closed",
      cash_sales: cashSales,
      other_cash_income: input.otherCashIncome,
      cash_expenses: input.cashExpenses,
      cash_withdrawals: input.cashWithdrawals,
      expected_closing_balance: expectedClosingBalance,
      actual_cash_count: input.actualCashCount,
      difference,
      notes: input.notes?.trim() || null,
      closed_by: userId,
      closed_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) {
    console.error("[Inventra] closeCashRegister failed:", error);
    throw new Error("Could not close the cash register.");
  }

  revalidatePath("/cash-register");
  revalidatePath("/dashboard");
  const branchName = (register as unknown as { warehouses: { name: string } | null }).warehouses?.name ?? "Branch";
  await logAudit({
    orgId,
    actorId: userId,
    actorName,
    actorRole: role,
    action: "cash_register.closed",
    module: "Cash Register",
    entityType: "daily_cash_register",
    entityId: id,
    entityLabel: `${branchName} — ${register.business_date}`,
    newValue: { expectedClosingBalance, actualCashCount: input.actualCashCount, difference },
    branchId: register.warehouse_id,
    branchName,
  });

  if (difference !== 0) {
    await notifyApprovers(supabase, {
      orgId,
      excludeUserId: userId,
      type: "cash_discrepancy",
      title: `⚠ Cash difference at ${branchName}`,
      body: `${difference > 0 ? "Overage" : "Shortage"} of ${Math.abs(difference).toFixed(2)} detected closing ${register.business_date}.`,
      entityType: "daily_cash_register",
      entityId: id,
    });
  } else {
    await notifyApprovers(supabase, {
      orgId,
      excludeUserId: userId,
      type: "cash_register_closed",
      title: `✅ ${branchName} closed and balanced`,
      body: `Business day ${register.business_date} closed with no discrepancy.`,
      entityType: "daily_cash_register",
      entityId: id,
    });
  }

  return { expectedClosingBalance, difference };
}
