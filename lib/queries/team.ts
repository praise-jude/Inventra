import "server-only";
import { createClient } from "@/lib/supabase/server";

// Team Management (the invite/approve/reject/role UI, /team, /accept-invite)
// was removed in favor of branch-code signup (see lib/actions/branches.ts) —
// this file now only backs the Dashboard's "who's active" presence card,
// which isn't part of that removal.

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

// Active members only, for the Dashboard's presence card — bounded by
// actual current headcount, so it doesn't need pagination.
export async function getActiveTeamMembersForPresence(): Promise<TeamMemberRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("profiles").select(TEAM_SELECT).eq("status", "active").limit(200);
  if (error) {
    console.error("[Inventra] getActiveTeamMembersForPresence failed:", error);
    return [];
  }
  return (data ?? []).map(mapTeamRow);
}
