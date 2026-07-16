import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

export interface PlatformStats {
  totalSubscribers: number;
  trialUsers: number;
  expiredUsers: number;
  monthlySubscribers: number;
  yearlySubscribers: number;
  cancelledPlans: number;
  totalRevenue: number;
  renewalsLast30Days: number;
}

// Cross-org aggregates for the platform admin dashboard — uses the
// service-role client since RLS on these tables scopes everything to
// current_org_id(), which doesn't apply to a platform-wide view.
export async function getPlatformStats(): Promise<PlatformStats> {
  const admin = createAdminClient();

  const [{ data: subs }, { data: revenueRows }, { count: renewalsCount }] = await Promise.all([
    admin.from("subscriptions").select("status, plan_key"),
    admin.from("invoices").select("amount").eq("status", "paid"),
    admin
      .from("invoices")
      .select("id", { count: "exact", head: true })
      .eq("status", "paid")
      .gte("issued_at", new Date(Date.now() - 30 * 86_400_000).toISOString().slice(0, 10)),
  ]);

  const rows = subs ?? [];
  return {
    totalSubscribers: rows.length,
    trialUsers: rows.filter((s) => s.status === "trialing").length,
    expiredUsers: rows.filter((s) => s.status === "expired").length,
    monthlySubscribers: rows.filter((s) => s.status === "active" && s.plan_key === "monthly").length,
    yearlySubscribers: rows.filter((s) => s.status === "active" && s.plan_key === "yearly").length,
    cancelledPlans: rows.filter((s) => s.status === "cancelled").length,
    totalRevenue: (revenueRows ?? []).reduce((sum, r) => sum + r.amount, 0),
    renewalsLast30Days: renewalsCount ?? 0,
  };
}

export interface OrgSubscriptionRow {
  orgId: string;
  orgName: string;
  ownerEmail: string | null;
  planKey: string;
  status: string;
  trialEndsAt: string | null;
  currentPeriodEnd: string | null;
}

// Simple ILIKE search across org name / owner email — fine at this scale;
// revisit with a proper search index if the org count grows large.
export async function searchOrgSubscriptions(query: string): Promise<OrgSubscriptionRow[]> {
  const admin = createAdminClient();

  let orgIds: string[] | null = null;
  const trimmed = query.trim();
  if (trimmed) {
    const [{ data: orgMatches }, { data: profileMatches }] = await Promise.all([
      admin.from("organizations").select("id").ilike("name", `%${trimmed}%`),
      admin.from("profiles").select("org_id").eq("role", "owner").ilike("email", `%${trimmed}%`),
    ]);
    orgIds = Array.from(new Set([...(orgMatches ?? []).map((o) => o.id), ...(profileMatches ?? []).map((p) => p.org_id)]));
    if (orgIds.length === 0) return [];
  }

  let subsQuery = admin
    .from("subscriptions")
    .select("org_id, plan_key, status, trial_ends_at, current_period_end")
    .order("created_at", { ascending: false })
    .limit(50);
  if (orgIds) subsQuery = subsQuery.in("org_id", orgIds);
  const { data: subs } = await subsQuery;
  if (!subs || subs.length === 0) return [];

  const ids = subs.map((s) => s.org_id);
  const [{ data: orgs }, { data: owners }] = await Promise.all([
    admin.from("organizations").select("id, name").in("id", ids),
    admin.from("profiles").select("org_id, email").eq("role", "owner").in("org_id", ids),
  ]);
  const orgById = new Map((orgs ?? []).map((o) => [o.id, o.name]));
  const ownerByOrg = new Map((owners ?? []).map((p) => [p.org_id, p.email]));

  return subs.map((s) => ({
    orgId: s.org_id,
    orgName: orgById.get(s.org_id) ?? s.org_id,
    ownerEmail: ownerByOrg.get(s.org_id) ?? null,
    planKey: s.plan_key,
    status: s.status,
    trialEndsAt: s.trial_ends_at,
    currentPeriodEnd: s.current_period_end,
  }));
}
