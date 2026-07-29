"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { canAddExpense, UpgradeRequiredError } from "@/lib/entitlements";
import { logAudit } from "@/lib/actions/audit";

// Mirrors lib/actions/categories.ts's requireManagerOrgId, extended with
// the actor fields logAudit needs (matches warehouses.ts/invoices.ts's
// shape) rather than the bare {supabase, orgId} this used to return.
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
  if (!["owner", "admin", "manager"].includes(profile.role)) {
    throw new Error("Only an owner, admin, or manager can manage expenses.");
  }
  return {
    supabase,
    orgId: profile.org_id as string,
    userId: user.id,
    role: profile.role as string,
    actorName: `${profile.first_name} ${profile.last_name}`,
  };
}

export interface ExpenseInput {
  category: string;
  description?: string;
  amount: number;
  incurredAt: string;
}

export async function createExpense(input: ExpenseInput) {
  const { supabase, orgId, userId, role, actorName } = await requireManagerOrgId();
  if (!(await canAddExpense())) {
    throw new UpgradeRequiredError("You've reached your Free Plan limit of 10 expenses. Upgrade to Premium for unlimited expenses.");
  }
  if (input.amount <= 0) throw new Error("Amount must be greater than zero.");

  const { data: expense, error } = await supabase
    .from("expenses")
    .insert({
      org_id: orgId,
      category: input.category,
      description: input.description?.trim() || null,
      amount: input.amount,
      incurred_at: input.incurredAt,
    })
    .select("id")
    .single();
  if (error) {
    console.error("[Inventra] createExpense failed:", error);
    throw new Error("Could not create the expense.");
  }
  revalidatePath("/expenses");
  revalidatePath("/dashboard");

  void logAudit({
    orgId,
    actorId: userId,
    actorName,
    actorRole: role,
    action: "expense.created",
    module: "Expenses",
    entityType: "expense",
    entityId: expense.id as string,
    entityLabel: input.category,
    newValue: { category: input.category, amount: input.amount, incurredAt: input.incurredAt },
  });
}

export async function updateExpense(id: string, input: ExpenseInput) {
  const { supabase, orgId, userId, role, actorName } = await requireManagerOrgId();
  if (input.amount <= 0) throw new Error("Amount must be greater than zero.");

  const { data: before } = await supabase.from("expenses").select("category, amount, incurred_at").eq("id", id).maybeSingle();

  const { error } = await supabase
    .from("expenses")
    .update({
      category: input.category,
      description: input.description?.trim() || null,
      amount: input.amount,
      incurred_at: input.incurredAt,
    })
    .eq("id", id);
  if (error) {
    console.error("[Inventra] updateExpense failed:", error);
    throw new Error("Could not update the expense.");
  }
  revalidatePath("/expenses");
  revalidatePath("/dashboard");

  void logAudit({
    orgId,
    actorId: userId,
    actorName,
    actorRole: role,
    action: "expense.updated",
    module: "Expenses",
    entityType: "expense",
    entityId: id,
    entityLabel: input.category,
    previousValue: before,
    newValue: { category: input.category, amount: input.amount, incurredAt: input.incurredAt },
  });
}

export async function deleteExpense(id: string) {
  const { supabase, orgId, userId, role, actorName } = await requireManagerOrgId();

  const { data: expense } = await supabase.from("expenses").select("category, amount").eq("id", id).maybeSingle();
  const { error } = await supabase.from("expenses").delete().eq("id", id);
  if (error) {
    console.error("[Inventra] deleteExpense failed:", error);
    throw new Error("Could not delete the expense.");
  }
  revalidatePath("/expenses");
  revalidatePath("/dashboard");

  void logAudit({
    orgId,
    actorId: userId,
    actorName,
    actorRole: role,
    action: "expense.deleted",
    module: "Expenses",
    entityType: "expense",
    entityId: id,
    entityLabel: expense?.category ?? id,
    previousValue: expense ? { category: expense.category, amount: expense.amount } : null,
  });
}
