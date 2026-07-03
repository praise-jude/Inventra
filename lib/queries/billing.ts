import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { Invoice } from "@/lib/billing-plans";

export async function getBillingData() {
  const supabase = await createClient();
  const { data: profile } = await supabase.auth.getUser();
  const userId = profile.user?.id;
  const { data: myProfile } = await supabase.from("profiles").select("org_id").eq("id", userId).single();
  const orgId = myProfile?.org_id;

  const [{ data: org }, { count: seats }, { count: skus }, { count: warehouses }, { data: invoices }] = await Promise.all([
    supabase.from("organizations").select("*").eq("id", orgId).single(),
    supabase.from("profiles").select("id", { count: "exact", head: true }).eq("org_id", orgId),
    supabase.from("products").select("id", { count: "exact", head: true }).eq("org_id", orgId).is("archived_at", null),
    supabase.from("warehouses").select("id", { count: "exact", head: true }).eq("org_id", orgId),
    supabase.from("invoices").select("*").eq("org_id", orgId).order("issued_at", { ascending: false }),
  ]);

  return {
    org: org!,
    seatsUsed: seats ?? 0,
    skuCount: skus ?? 0,
    warehouseCount: warehouses ?? 0,
    invoices: (invoices ?? []) as Invoice[],
  };
}
