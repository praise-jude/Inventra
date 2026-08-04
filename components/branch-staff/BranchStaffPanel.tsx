"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/app/ToastProvider";
import { approveBranchStaff, rejectBranchStaff, removeBranchStaff, resendBranchStaffInvite } from "@/lib/actions/branch-staff";
import type { BranchStaffRow } from "@/lib/queries/branch-staff";
import { InviteStaffModal } from "@/components/branch-staff/InviteStaffModal";

const ROLE_LABEL: Record<string, string> = { manager: "Manager", cashier: "Cashier", warehouse: "Warehouse" };
const STATUS_LABEL: Record<string, string> = { invited: "Invited", awaiting_approval: "Awaiting approval", active: "Active" };

// Shared by the Admin's per-branch card on /settings/branches (isAdmin,
// canResend/canRemove) and the Manager's own-branch view on
// /branch-staff (canApprove only, own branch pre-filtered server-side by
// lib/queries/branch-staff.ts's listBranchStaff). Mirrors the old
// TeamClient.tsx's roster rendering, narrowed to one branch at a time.
export function BranchStaffPanel({
  branchId,
  branchName,
  staff,
  isAdmin,
}: {
  branchId: string;
  branchName: string;
  staff: BranchStaffRow[];
  isAdmin: boolean;
}) {
  const router = useRouter();
  const flash = useToast();
  const [inviting, setInviting] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function run(id: string, fn: () => Promise<void>, successMessage: string) {
    setBusyId(id);
    try {
      await fn();
      flash(successMessage);
      router.refresh();
    } catch (err) {
      flash(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <div className="text-[11px] font-semibold text-text-2">Staff</div>
        <button onClick={() => setInviting(true)} className="text-[11.5px] font-semibold text-accent-text">
          + Invite
        </button>
      </div>

      {staff.length === 0 ? (
        <div className="text-[12px] text-muted">No staff invited yet.</div>
      ) : (
        <div className="flex flex-col gap-1.5">
          {staff.map((s) => (
            <div key={s.id} className="flex items-center justify-between gap-2 rounded-[8px] border border-border bg-hover px-2.5 py-1.5">
              <div className="min-w-0">
                <div className="truncate text-[12.5px] font-semibold">
                  {s.firstName} {s.lastName}
                </div>
                <div className="text-[11px] text-muted">
                  {ROLE_LABEL[s.role] ?? s.role} · {STATUS_LABEL[s.status] ?? s.status}
                </div>
              </div>
              <div className="flex shrink-0 gap-1">
                {s.status === "awaiting_approval" && (
                  <>
                    <button
                      onClick={() => run(s.id, () => approveBranchStaff(s.id), "Approved")}
                      disabled={busyId === s.id}
                      className="h-6 rounded-[6px] border border-border bg-surface px-2 text-[11px] font-semibold text-green hover:bg-hover disabled:opacity-50"
                    >
                      Approve
                    </button>
                    <button
                      onClick={() => run(s.id, () => rejectBranchStaff(s.id), "Rejected")}
                      disabled={busyId === s.id}
                      className="h-6 rounded-[6px] border border-border bg-surface px-2 text-[11px] font-semibold text-red hover:bg-hover disabled:opacity-50"
                    >
                      Reject
                    </button>
                  </>
                )}
                {isAdmin && s.status === "invited" && (
                  <button
                    onClick={() => run(s.id, () => resendBranchStaffInvite(s.id), "Invite resent")}
                    disabled={busyId === s.id}
                    className="h-6 rounded-[6px] border border-border bg-surface px-2 text-[11px] font-semibold text-text hover:bg-hover disabled:opacity-50"
                  >
                    Resend
                  </button>
                )}
                {isAdmin && (
                  <button
                    onClick={() => {
                      if (window.confirm(`Remove ${s.firstName} ${s.lastName}?`)) run(s.id, () => removeBranchStaff(s.id), "Removed");
                    }}
                    disabled={busyId === s.id}
                    className="h-6 rounded-[6px] border border-border bg-surface px-2 text-[11px] font-semibold text-red hover:bg-hover disabled:opacity-50"
                  >
                    Remove
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {inviting && <InviteStaffModal branchId={branchId} branchName={branchName} isAdmin={isAdmin} onClose={() => setInviting(false)} />}
    </div>
  );
}
