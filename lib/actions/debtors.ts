"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { canManageCustomers, UpgradeRequiredError } from "@/lib/entitlements";
import { logAudit } from "@/lib/actions/audit";
import { getDebtorDetail, type DebtorDetail } from "@/lib/queries/debtors";

async function requireOrgId() {
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
  return {
    supabase,
    orgId: profile.org_id as string,
    userId: user.id,
    role: profile.role as string,
    actorName: `${profile.first_name} ${profile.last_name}`,
  };
}

export interface DebtorInput {
  customerName: string;
  phone?: string;
  email?: string;
  amountOwed: number;
  dueDate?: string;
  notes?: string;
}

export async function fetchDebtorDetail(id: string): Promise<DebtorDetail | null> {
  return getDebtorDetail(id);
}

export async function createDebtor(input: DebtorInput) {
  const { supabase, orgId, userId, role, actorName } = await requireOrgId();
  if (!(await canManageCustomers())) {
    throw new UpgradeRequiredError("Customer management is a Premium feature. Upgrade to Premium to track customer credit.");
  }
  const customerName = input.customerName.trim();
  if (!customerName) throw new Error("Customer name is required.");
  if (input.amountOwed < 0) throw new Error("Amount owed can't be negative.");

  const { data: debtor, error } = await supabase
    .from("debtors")
    .insert({
      org_id: orgId,
      customer_name: customerName,
      phone: input.phone?.trim() || null,
      email: input.email?.trim() || null,
      amount_owed: input.amountOwed,
      due_date: input.dueDate || null,
      notes: input.notes?.trim() || null,
    })
    .select("id")
    .single();
  if (error) {
    console.error("[Inventra] createDebtor failed:", error);
    throw new Error("Could not create the debtor.");
  }
  revalidatePath("/debtors");

  void logAudit({
    orgId,
    actorId: userId,
    actorName,
    actorRole: role,
    action: "customer.created",
    module: "Customers",
    entityType: "debtor",
    entityId: debtor.id as string,
    entityLabel: customerName,
    newValue: { amountOwed: input.amountOwed },
  });
}

export async function updateDebtor(id: string, input: DebtorInput & { status?: string }) {
  const { supabase, orgId, userId, role, actorName } = await requireOrgId();
  if (!(await canManageCustomers())) {
    throw new UpgradeRequiredError("Customer management is a Premium feature. Upgrade to Premium to track customer credit.");
  }
  const customerName = input.customerName.trim();
  if (!customerName) throw new Error("Customer name is required.");

  const patch: Record<string, unknown> = {
    customer_name: customerName,
    phone: input.phone?.trim() || null,
    email: input.email?.trim() || null,
    due_date: input.dueDate || null,
    notes: input.notes?.trim() || null,
  };
  if (input.status) patch.status = input.status;

  const { error } = await supabase.from("debtors").update(patch).eq("id", id);
  if (error) {
    console.error("[Inventra] updateDebtor failed:", error);
    throw new Error("Could not update the debtor.");
  }
  revalidatePath("/debtors");

  void logAudit({
    orgId,
    actorId: userId,
    actorName,
    actorRole: role,
    action: "customer.updated",
    module: "Customers",
    entityType: "debtor",
    entityId: id,
    entityLabel: customerName,
    newValue: { amountOwed: input.amountOwed, status: input.status },
  });
}

export async function updateDebtorStatus(id: string, status: string) {
  const { supabase, orgId, userId, role, actorName } = await requireOrgId();
  if (!(await canManageCustomers())) {
    throw new UpgradeRequiredError("Customer management is a Premium feature. Upgrade to Premium to track customer credit.");
  }
  const { data: debtor } = await supabase.from("debtors").select("customer_name").eq("id", id).maybeSingle();
  const { error } = await supabase.from("debtors").update({ status }).eq("id", id);
  if (error) {
    console.error("[Inventra] updateDebtorStatus failed:", error);
    throw new Error("Could not update the debtor's status.");
  }
  revalidatePath("/debtors");

  void logAudit({
    orgId,
    actorId: userId,
    actorName,
    actorRole: role,
    action: "customer.status_changed",
    module: "Customers",
    entityType: "debtor",
    entityId: id,
    entityLabel: debtor?.customer_name ?? id,
    newValue: { status },
  });
}

export async function deleteDebtor(id: string) {
  const { supabase, orgId, userId, role, actorName } = await requireOrgId();
  if (!(await canManageCustomers())) {
    throw new UpgradeRequiredError("Customer management is a Premium feature. Upgrade to Premium to track customer credit.");
  }
  if (!["owner", "admin"].includes(role)) {
    throw new Error("Only an owner or admin can delete a debtor.");
  }

  const { data: debtor } = await supabase.from("debtors").select("customer_name").eq("id", id).maybeSingle();
  const { error } = await supabase.from("debtors").delete().eq("id", id);
  if (error) {
    console.error("[Inventra] deleteDebtor failed:", error);
    throw new Error("Could not delete the debtor.");
  }
  revalidatePath("/debtors");

  void logAudit({
    orgId,
    actorId: userId,
    actorName,
    actorRole: role,
    action: "customer.deleted",
    module: "Customers",
    entityType: "debtor",
    entityId: id,
    entityLabel: debtor?.customer_name ?? id,
  });
}

export async function recordPayment(debtorId: string, amount: number, note?: string) {
  const { supabase, orgId, userId, role, actorName } = await requireOrgId();
  if (!(await canManageCustomers())) {
    throw new UpgradeRequiredError("Customer management is a Premium feature. Upgrade to Premium to track customer credit.");
  }
  if (amount <= 0) throw new Error("Payment amount must be greater than zero.");

  const { data: debtor } = await supabase.from("debtors").select("amount_owed, customer_name").eq("id", debtorId).single();
  if (!debtor) throw new Error("Debtor not found.");
  if (amount > Number(debtor.amount_owed)) {
    throw new Error("Payment amount can't exceed the outstanding balance.");
  }

  const { error } = await supabase
    .from("debtor_payments")
    .insert({ org_id: orgId, debtor_id: debtorId, amount, note: note?.trim() || null });
  if (error) {
    console.error("[Inventra] recordPayment failed:", error);
    throw new Error("Could not record the payment.");
  }
  revalidatePath("/debtors");

  void logAudit({
    orgId,
    actorId: userId,
    actorName,
    actorRole: role,
    action: "customer.payment_recorded",
    module: "Customers",
    entityType: "debtor",
    entityId: debtorId,
    entityLabel: debtor.customer_name,
    newValue: { amount, note: note ?? null },
  });
}
