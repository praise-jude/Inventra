import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { Invoice, Subscription } from "@/lib/supabase/database.types";

export async function getBillingData() {
  const supabase = await createClient();
  const { data: profile } = await supabase.auth.getUser();
  const userId = profile.user?.id;
  const { data: myProfile } = await supabase.from("profiles").select("org_id").eq("id", userId).single();
  const orgId = myProfile?.org_id;

  const [{ data: org }, { data: subscription }, { data: invoices }] = await Promise.all([
    supabase.from("organizations").select("*").eq("id", orgId).single(),
    supabase.from("subscriptions").select("*").eq("org_id", orgId).single<Subscription>(),
    supabase.from("invoices").select("*").eq("org_id", orgId).order("issued_at", { ascending: false }),
  ]);

  return {
    org: org!,
    subscription: subscription!,
    invoices: (invoices ?? []) as Invoice[],
  };
}
