import "server-only";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/queries/session";
import { isAdminRole } from "@/lib/roles";

export interface BranchStaffRow {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
  status: string;
  branchId: string | null;
  rejectedReason: string | null;
}

// profiles_select is org-wide (see supabase/migrations/20260708120000_init.sql),
// so a Manager COULD see every branch's staff via a raw query — this
// narrows to the caller's own branch for a Manager, matching the same
// branch-ownership boundary profiles_update_manager_approval already
// enforces for approve/reject. Admin/Owner see the whole org, same as
// getWarehousesOverview.
export async function listBranchStaff(): Promise<BranchStaffRow[]> {
  const { profile } = await requireProfile();
  const supabase = await createClient();

  let query = supabase
    .from("profiles")
    .select("id, first_name, last_name, email, role, status, branch_id, rejected_reason")
    .eq("org_id", profile.org_id)
    .in("status", ["invited", "awaiting_approval", "active"])
    .in("role", ["manager", "cashier", "warehouse"])
    .not("branch_id", "is", null)
    .order("created_at", { ascending: false });

  if (!isAdminRole(profile.role)) {
    query = query.eq("branch_id", profile.branch_id ?? "");
  }

  const { data, error } = await query;
  if (error) throw error;

  return (data ?? []).map((p) => ({
    id: p.id,
    firstName: p.first_name,
    lastName: p.last_name,
    email: p.email,
    role: p.role,
    status: p.status,
    branchId: p.branch_id,
    rejectedReason: p.rejected_reason,
  }));
}
