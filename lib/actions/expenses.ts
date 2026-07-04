"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

// Mirrors lib/actions/categories.ts's requireManagerOrgId.
async function requireManagerOrgId() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  const { data: profile } = await supabase.from("profiles").select("org_id, role").eq("id", user.id).single();
  if (!profile) throw new Error("No profile");
  if (!["owner", "admin", "manager"].includes(profile.role)) {
    throw new Error("Only an owner, admin, or manager can manage expenses.");
  }
  return { supabase, orgId: profile.org_id as string };
}

export interface ExpenseInput {
  category: string;
  description?: string;
  amount: number;
  incurredAt: string;
}

export async function createExpense(input: ExpenseInput) {
  const { supabase, orgId } = await requireManagerOrgId();
  if (input.amount <= 0) throw new Error("Amount must be greater than zero.");

  const { error } = await supabase.from("expenses").insert({
    org_id: orgId,
    category: input.category,
    description: input.description?.trim() || null,
    amount: input.amount,
    incurred_at: input.incurredAt,
  });
  if (error) {
    console.error("[Inventra] createExpense failed:", error);
    throw new Error("Could not create the expense.");
  }
  revalidatePath("/expenses");
  revalidatePath("/dashboard");
}

export async function updateExpense(id: string, input: ExpenseInput) {
  const { supabase } = await requireManagerOrgId();
  if (input.amount <= 0) throw new Error("Amount must be greater than zero.");

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
}

export async function deleteExpense(id: string) {
  const { supabase } = await requireManagerOrgId();

  const { error } = await supabase.from("expenses").delete().eq("id", id);
  if (error) {
    console.error("[Inventra] deleteExpense failed:", error);
    throw new Error("Could not delete the expense.");
  }
  revalidatePath("/expenses");
  revalidatePath("/dashboard");
}
