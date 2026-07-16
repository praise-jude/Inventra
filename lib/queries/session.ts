import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Organization, Profile } from "@/lib/supabase/database.types";
import { ADMIN_ROLES, MANAGER_ROLES } from "@/lib/roles";

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
  if (profile.suspended_at) {
    await supabase.auth.signOut();
    redirect("/login?suspended=1");
  }
  if (profile.rejected_at) {
    await supabase.auth.signOut();
    redirect("/login?rejected=1");
  }
  if (profile.status === "awaiting_approval") {
    redirect("/pending-approval");
  }

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
  if (!ADMIN_ROLES.includes(result.profile.role)) redirect("/dashboard");
  return result;
});

// Debtors/Expenses are Manager-tier+ (owner/admin/manager) — back-office
// financial data, not a day-to-day Cashier/Warehouse task.
export const requireManagerProfile = cache(async (): Promise<{ profile: Profile; org: Organization }> => {
  const result = await requireProfile();
  if (!MANAGER_ROLES.includes(result.profile.role)) redirect("/dashboard");
  return result;
});

// Sales is everyone's job except Warehouse (whose lane is stock
// movements/receiving, per the existing Team page role legend).
export const requireSalesProfile = cache(async (): Promise<{ profile: Profile; org: Organization }> => {
  const result = await requireProfile();
  if (result.profile.role === "warehouse") redirect("/dashboard");
  return result;
});

// Platform-admin (cross-org) access, deliberately separate from
// requireAdminProfile: that gate is scoped to a single org's owner/admin
// role, but the platform admin dashboard reads every org's billing data —
// an org admin must never qualify just by being an admin of their own org.
// Gated by a plain email allowlist for now (PLATFORM_ADMIN_EMAILS,
// comma-separated) rather than a new role/schema, since there's exactly one
// platform admin today; revisit if that ever needs to scale beyond a
// hardcoded list.
export const requirePlatformAdmin = cache(async (): Promise<{ email: string }> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) redirect("/login");

  const allowlist = (process.env.PLATFORM_ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  if (!allowlist.includes(user.email.toLowerCase())) redirect("/dashboard");

  return { email: user.email };
});
