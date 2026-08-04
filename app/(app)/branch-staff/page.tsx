import { redirect } from "next/navigation";
import { requireManagerProfile } from "@/lib/queries/session";
import { listBranchStaff } from "@/lib/queries/branch-staff";
import { createClient } from "@/lib/supabase/server";
import { isAdminRole } from "@/lib/roles";
import { BranchStaffPanel } from "@/components/branch-staff/BranchStaffPanel";

// Manager's own-branch equivalent of /settings/branches' admin-tier Staff
// section — same BranchStaffPanel, pre-filtered to one branch. Admin/Owner
// have the fuller view (every branch, plus branch CRUD) there instead, so
// they're redirected rather than landing on this narrower page.
export default async function BranchStaffPage() {
  const { profile } = await requireManagerProfile();
  if (isAdminRole(profile.role)) redirect("/settings/branches");
  if (!profile.branch_id) {
    return (
      <div className="rounded-2xl border border-border bg-surface p-8 text-center shadow-[var(--shadow-sm)]">
        <div className="mb-1.5 text-[15px] font-bold">No branch assigned</div>
        <p className="text-[13px] text-text-2">Ask an owner or admin to assign you to a branch before inviting staff.</p>
      </div>
    );
  }

  const supabase = await createClient();
  const [staff, { data: warehouse }] = await Promise.all([
    listBranchStaff(),
    supabase.from("warehouses").select("name").eq("id", profile.branch_id).single(),
  ]);

  return (
    <div className="animate-fade-up">
      <div className="mb-[18px]">
        <div className="text-[22px] font-bold tracking-tight">Branch Staff</div>
        <div className="mt-[3px] text-text-2">Invite and approve Cashier/Warehouse staff for {warehouse?.name ?? "your branch"}.</div>
      </div>
      <div className="rounded-2xl border border-border bg-surface p-[18px] shadow-[var(--shadow-sm)]">
        <BranchStaffPanel branchId={profile.branch_id} branchName={warehouse?.name ?? "your branch"} staff={staff} isAdmin={false} />
      </div>
    </div>
  );
}
