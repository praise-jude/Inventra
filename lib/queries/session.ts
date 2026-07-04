import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Organization, Profile } from "@/lib/supabase/database.types";

// The (app) layout calls this for the shell chrome, and most pages call it
// again for their own data — cache() dedupes to one auth+profile+org round
// trip per request instead of two.
export const requireProfile = cache(async (): Promise<{ profile: Profile; org: Organization }> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single<Profile>();
  if (!profile) redirect("/login");

  const { data: org } = await supabase
    .from("organizations")
    .select("*")
    .eq("id", profile.org_id)
    .single<Organization>();
  if (!org) redirect("/login");

  return { profile, org };
});

// Settings/Team are Admin-tier only (owner/admin) — this is the server-side
// gate; never rely on hiding the nav link alone.
export const requireAdminProfile = cache(async (): Promise<{ profile: Profile; org: Organization }> => {
  const result = await requireProfile();
  if (result.profile.role !== "owner" && result.profile.role !== "admin") redirect("/dashboard");
  return result;
});

// Debtors/Expenses are Manager-tier+ (owner/admin/manager) — back-office
// financial data, not a day-to-day Cashier/Warehouse task.
export const requireManagerProfile = cache(async (): Promise<{ profile: Profile; org: Organization }> => {
  const result = await requireProfile();
  if (!["owner", "admin", "manager"].includes(result.profile.role)) redirect("/dashboard");
  return result;
});
