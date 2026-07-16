"use server";

import { revalidatePath } from "next/cache";
import { requirePlatformAdmin } from "@/lib/queries/session";
import { createAdminClient } from "@/lib/supabase/admin";

// Independently re-checks authorization rather than trusting that only the
// gated /admin page could have called this — same defense-in-depth pattern
// as lib/actions/billing.ts's requireAdminContext().
export async function suspendOrgSubscription(orgId: string): Promise<void> {
  await requirePlatformAdmin();
  const admin = createAdminClient();
  const { error } = await admin.from("subscriptions").update({ status: "suspended" }).eq("org_id", orgId);
  if (error) throw error;
  revalidatePath("/admin");
}

export async function reactivateOrgSubscription(orgId: string): Promise<void> {
  await requirePlatformAdmin();
  const admin = createAdminClient();
  const { error } = await admin
    .from("subscriptions")
    .update({ status: "active", cancel_at_period_end: false, cancelled_at: null })
    .eq("org_id", orgId);
  if (error) throw error;
  revalidatePath("/admin");
}
