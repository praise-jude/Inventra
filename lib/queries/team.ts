import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { isAdminRole } from "@/lib/roles";

export interface TeamMemberRow {
  id: string;
  name: string;
  email: string;
  role: string;
  status: string;
  suspendedAt: string | null;
  rejectedAt: string | null;
  rejectedReason: string | null;
  approvedAt: string | null;
  acceptedAt: string | null;
  initials: string;
  lastActive: string | null;
  branchName: string | null;
}

const TEAM_SELECT =
  // profiles has two FKs to warehouses (warehouses.manager_profile_id and
  // this table's own branch_id) — PostgREST can't infer which one to embed
  // without the explicit !constraint hint, and errors with PGRST201.
  "id, first_name, last_name, email, role, status, suspended_at, rejected_at, rejected_reason, approved_at, accepted_at, last_active_at, warehouses!profiles_branch_id_fkey(name)";

function mapTeamRow(p: {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  role: string;
  status: string;
  suspended_at: string | null;
  rejected_at: string | null;
  rejected_reason: string | null;
  approved_at: string | null;
  accepted_at: string | null;
  last_active_at: string | null;
  warehouses: unknown;
}): TeamMemberRow {
  return {
    id: p.id,
    name: `${p.first_name} ${p.last_name}`,
    email: p.email,
    role: p.role,
    status: p.status,
    suspendedAt: p.suspended_at ?? null,
    rejectedAt: p.rejected_at ?? null,
    rejectedReason: p.rejected_reason ?? null,
    approvedAt: p.approved_at ?? null,
    acceptedAt: p.accepted_at ?? null,
    initials: `${p.first_name[0] ?? ""}${p.last_name[0] ?? ""}`.toUpperCase(),
    lastActive: p.last_active_at,
    branchName: (p.warehouses as unknown as { name: string } | null)?.name ?? null,
  };
}

export interface TeamMembersFilters {
  search?: string;
  status?: "all" | "invited" | "awaiting_approval" | "active" | "suspended" | "rejected";
}

// Server-side paginated + filtered, mirrors this session's Debtors/Invoices/
// Supply Records pagination work — profiles never deletes invited/rejected/
// suspended rows, so an org with real staff turnover over time can
// realistically accumulate hundreds of them, same unbounded-growth shape
// those other lists had.
export async function getTeamMembersPage(
  filters: TeamMembersFilters,
  page = 1,
  pageSize = 20,
): Promise<{ rows: TeamMemberRow[]; total: number }> {
  const supabase = await createClient();
  let query = supabase.from("profiles").select(TEAM_SELECT, { count: "exact" }).order("created_at", { ascending: true });

  if (filters.status && filters.status !== "all") {
    if (filters.status === "rejected") query = query.not("rejected_at", "is", null);
    else if (filters.status === "suspended") query = query.not("suspended_at", "is", null).is("rejected_at", null);
    else query = query.eq("status", filters.status).is("rejected_at", null).is("suspended_at", null);
  }
  if (filters.search?.trim()) {
    const q = filters.search.trim().replace(/[%,]/g, "");
    query = query.or(`first_name.ilike.%${q}%,last_name.ilike.%${q}%,email.ilike.%${q}%`);
  }

  const from = (page - 1) * pageSize;
  const { data, error, count } = await query.range(from, from + pageSize - 1);
  if (error) {
    console.error("[Inventra] getTeamMembersPage failed:", error);
    throw new Error("Could not load team members. Please try again.");
  }
  return { rows: (data ?? []).map(mapTeamRow), total: count ?? 0 };
}

export interface TeamSummary {
  total: number;
  invited: number;
  awaitingApproval: number;
  active: number;
  suspended: number;
  rejected: number;
}

// Lightweight aggregate scan (3 columns, not the full row shape) so the
// Team page's status-filter cards always reflect the FULL roster, not just
// the current page — same split as getDebtorsOverview/getInvoicesOverview.
export async function getTeamSummary(): Promise<TeamSummary> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("profiles").select("status, suspended_at, rejected_at");
  if (error) {
    console.error("[Inventra] getTeamSummary failed:", error);
    return { total: 0, invited: 0, awaitingApproval: 0, active: 0, suspended: 0, rejected: 0 };
  }
  const rows = data ?? [];
  const summary: TeamSummary = { total: rows.length, invited: 0, awaitingApproval: 0, active: 0, suspended: 0, rejected: 0 };
  for (const r of rows) {
    if (r.rejected_at) summary.rejected++;
    else if (r.suspended_at) summary.suspended++;
    else if (r.status === "invited") summary.invited++;
    else if (r.status === "awaiting_approval") summary.awaitingApproval++;
    else if (r.status === "active") summary.active++;
  }
  return summary;
}

// Active members only, for the Dashboard's presence card — bounded by
// actual current headcount (not the full historical invited/rejected/
// suspended roster getTeamMembersPage covers), so it doesn't need
// pagination: real headcounts don't grow into the hundreds the way
// cumulative invite history can.
export async function getActiveTeamMembersForPresence(): Promise<TeamMemberRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("profiles").select(TEAM_SELECT).eq("status", "active").limit(200);
  if (error) {
    console.error("[Inventra] getActiveTeamMembersForPresence failed:", error);
    return [];
  }
  return (data ?? []).map(mapTeamRow);
}

// Scoped to exactly what the viewer can act on — Owner/Admin see the whole
// org's queue, a Manager only sees their own branch's (matching the
// branch-scoped RLS/trigger in 20260801140000_branch_scoped_manager_approval.sql)
// so this count never promises more than approveMember()/rejectMember() can
// actually do. Cashier/Warehouse always get 0 (they can't approve at all).
// cache()'d — both the app-shell layout (team nav badge) and the dashboard
// page need this on every dashboard request; without it that's two DB round
// trips instead of one, same reasoning as getKpis() in queries/dashboard.ts.
export const getPendingApprovalsCount = cache(async (role: string, branchId: string | null): Promise<number> => {
  if (!isAdminRole(role) && !(role === "manager" && branchId)) return 0;

  const supabase = await createClient();
  let query = supabase.from("profiles").select("id", { count: "exact", head: true }).eq("status", "awaiting_approval");
  if (role === "manager") query = query.eq("branch_id", branchId as string);
  const { count, error } = await query;
  if (error) {
    console.error("[Inventra] getPendingApprovalsCount failed:", error);
    return 0;
  }
  return count ?? 0;
});
