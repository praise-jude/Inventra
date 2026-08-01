import "server-only";
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

export async function getTeamMembers(): Promise<TeamMemberRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    // profiles has two FKs to warehouses (warehouses.manager_profile_id and
    // this table's own branch_id) — PostgREST can't infer which one to embed
    // without the explicit !constraint hint, and errors with PGRST201.
    .select(
      "id, first_name, last_name, email, role, status, suspended_at, rejected_at, rejected_reason, approved_at, accepted_at, last_active_at, warehouses!profiles_branch_id_fkey(name)",
    )
    .order("created_at", { ascending: true });
  if (error) {
    console.error("[Inventra] getTeamMembers failed:", error);
    throw new Error("Could not load team members. Please try again.");
  }
  return (data ?? []).map((p) => ({
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
  }));
}

// Scoped to exactly what the viewer can act on — Owner/Admin see the whole
// org's queue, a Manager only sees their own branch's (matching the
// branch-scoped RLS/trigger in 20260801140000_branch_scoped_manager_approval.sql)
// so this count never promises more than approveMember()/rejectMember() can
// actually do. Cashier/Warehouse always get 0 (they can't approve at all).
export async function getPendingApprovalsCount(role: string, branchId: string | null): Promise<number> {
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
}
