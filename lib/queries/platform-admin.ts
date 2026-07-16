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

const EMPTY_STATS: PlatformStats = {
  totalSubscribers: 0,
  trialUsers: 0,
  expiredUsers: 0,
  monthlySubscribers: 0,
  yearlySubscribers: 0,
  cancelledPlans: 0,
  totalRevenue: 0,
  renewalsLast30Days: 0,
};

// Cross-org aggregates for the platform admin dashboard — uses the
// service-role client since RLS on these tables scopes everything to
// current_org_id(), which doesn't apply to a platform-wide view.
//
// Wrapped end-to-end: this page has no fallback UI of its own, so an
// unhandled rejection here (a transient network/connection error on any of
// the three queries) would surface as a full "Server Components render"
// crash rather than a degraded-but-working dashboard.
export async function getPlatformStats(): Promise<PlatformStats> {
  try {
    const admin = createAdminClient();

    const [subsRes, revenueRes, renewalsRes] = await Promise.all([
      admin.from("subscriptions").select("status, plan_key"),
      admin.from("invoices").select("amount").eq("status", "paid"),
      admin
        .from("invoices")
        .select("id", { count: "exact", head: true })
        .eq("status", "paid")
        .gte("issued_at", new Date(Date.now() - 30 * 86_400_000).toISOString().slice(0, 10)),
    ]);

    if (subsRes.error) console.error("[Inventra] getPlatformStats subscriptions query failed:", subsRes.error);
    if (revenueRes.error) console.error("[Inventra] getPlatformStats revenue query failed:", revenueRes.error);
    if (renewalsRes.error) console.error("[Inventra] getPlatformStats renewals query failed:", renewalsRes.error);

    const rows = subsRes.data ?? [];
    return {
      totalSubscribers: rows.length,
      trialUsers: rows.filter((s) => s.status === "trialing").length,
      expiredUsers: rows.filter((s) => s.status === "expired").length,
      monthlySubscribers: rows.filter((s) => s.status === "active" && s.plan_key === "monthly").length,
      yearlySubscribers: rows.filter((s) => s.status === "active" && s.plan_key === "yearly").length,
      cancelledPlans: rows.filter((s) => s.status === "cancelled").length,
      totalRevenue: (revenueRes.data ?? []).reduce((sum, r) => sum + r.amount, 0),
      renewalsLast30Days: renewalsRes.count ?? 0,
    };
  } catch (err) {
    console.error("[Inventra] getPlatformStats threw:", err);
    return EMPTY_STATS;
  }
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
//
// Wrapped end-to-end for the same reason as getPlatformStats above — an
// unhandled rejection on any of these four queries would otherwise crash
// the whole /admin page instead of just returning an empty result set.
export async function searchOrgSubscriptions(query: string): Promise<OrgSubscriptionRow[]> {
  try {
    const admin = createAdminClient();

    let orgIds: string[] | null = null;
    const trimmed = query.trim();
    if (trimmed) {
      const [orgMatchesRes, profileMatchesRes] = await Promise.all([
        admin.from("organizations").select("id").ilike("name", `%${trimmed}%`),
        admin.from("profiles").select("org_id").eq("role", "owner").ilike("email", `%${trimmed}%`),
      ]);
      if (orgMatchesRes.error) console.error("[Inventra] searchOrgSubscriptions org search failed:", orgMatchesRes.error);
      if (profileMatchesRes.error) console.error("[Inventra] searchOrgSubscriptions profile search failed:", profileMatchesRes.error);
      orgIds = Array.from(
        new Set([...(orgMatchesRes.data ?? []).map((o) => o.id), ...(profileMatchesRes.data ?? []).map((p) => p.org_id)]),
      );
      if (orgIds.length === 0) return [];
    }

    let subsQuery = admin
      .from("subscriptions")
      .select("org_id, plan_key, status, trial_ends_at, current_period_end")
      .order("created_at", { ascending: false })
      .limit(50);
    if (orgIds) subsQuery = subsQuery.in("org_id", orgIds);
    const { data: subs, error: subsError } = await subsQuery;
    if (subsError) console.error("[Inventra] searchOrgSubscriptions subscriptions query failed:", subsError);
    if (!subs || subs.length === 0) return [];

    const ids = subs.map((s) => s.org_id);
    const [orgsRes, ownersRes] = await Promise.all([
      admin.from("organizations").select("id, name").in("id", ids),
      admin.from("profiles").select("org_id, email").eq("role", "owner").in("org_id", ids),
    ]);
    if (orgsRes.error) console.error("[Inventra] searchOrgSubscriptions org lookup failed:", orgsRes.error);
    if (ownersRes.error) console.error("[Inventra] searchOrgSubscriptions owner lookup failed:", ownersRes.error);
    const orgById = new Map((orgsRes.data ?? []).map((o) => [o.id, o.name]));
    const ownerByOrg = new Map((ownersRes.data ?? []).map((p) => [p.org_id, p.email]));

    return subs.map((s) => ({
      orgId: s.org_id,
      orgName: orgById.get(s.org_id) ?? s.org_id,
      ownerEmail: ownerByOrg.get(s.org_id) ?? null,
      planKey: s.plan_key,
      status: s.status,
      trialEndsAt: s.trial_ends_at,
      currentPeriodEnd: s.current_period_end,
    }));
  } catch (err) {
    console.error("[Inventra] searchOrgSubscriptions threw:", err);
    return [];
  }
}
