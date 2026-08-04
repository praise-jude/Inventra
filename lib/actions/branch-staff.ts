"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { logAudit } from "@/lib/actions/audit";
import { createNotification } from "@/lib/notifications-service";
import {
  resolveBranchStaffContext,
  inviteBranchStaffForContext,
  resendBranchStaffInviteForContext,
  removeBranchStaffForContext,
  type InviteBranchStaffInput,
} from "@/lib/branch-staff-service";

export async function inviteBranchStaff(input: InviteBranchStaffInput) {
  const supabase = await createClient();
  const context = await resolveBranchStaffContext(supabase, { allowManager: true });
  await inviteBranchStaffForContext(context, input);

  revalidatePath("/settings/branches");

  await logAudit({
    orgId: context.profile.org_id,
    actorId: context.profile.id,
    actorName: context.actorName,
    actorRole: context.actorRole,
    action: "user.invited",
    module: "Branch Staff",
    entityType: "profile",
    entityLabel: `${input.firstName} ${input.lastName} (${input.email})`,
    newValue: { email: input.email, role: input.role, branchId: input.branchId },
  });
}

export async function resendBranchStaffInvite(memberId: string) {
  const supabase = await createClient();
  const context = await resolveBranchStaffContext(supabase);
  const { data: member } = await supabase.from("profiles").select("first_name, last_name, email").eq("id", memberId).single();
  if (!member) throw new Error("Member not found.");

  await resendBranchStaffInviteForContext(supabase, context, memberId);
  revalidatePath("/settings/branches");

  await logAudit({
    orgId: context.profile.org_id,
    actorId: context.profile.id,
    actorName: context.actorName,
    actorRole: context.actorRole,
    action: "user.invite_resent",
    module: "Branch Staff",
    entityType: "profile",
    entityId: memberId,
    entityLabel: `${member.first_name} ${member.last_name} (${member.email})`,
  });
}

// approveBranchStaff/rejectBranchStaff are plain RLS-scoped table writes —
// guard_profile_status_transitions() and profiles_update_manager_approval
// (20260801140000_branch_scoped_manager_approval.sql) already enforce who
// can touch an awaiting_approval row: any Admin/Owner, or a Manager whose
// own branch_id matches the invitee's. This is a thin wrapper purely for
// the audit trail and cache revalidation.
export async function approveBranchStaff(memberId: string) {
  const supabase = await createClient();
  const context = await resolveBranchStaffContext(supabase, { allowManager: true });

  const { data: member } = await supabase
    .from("profiles")
    .select("org_id, first_name, last_name, status")
    .eq("id", memberId)
    .single();
  if (!member || member.org_id !== context.profile.org_id) throw new Error("Member not found.");
  if (member.status !== "awaiting_approval") throw new Error("This member isn't awaiting approval.");

  const now = new Date().toISOString();
  const { error } = await supabase
    .from("profiles")
    .update({ status: "active", approved_by: context.profile.id, approved_at: now })
    .eq("id", memberId)
    .eq("org_id", context.profile.org_id);
  if (error) throw new Error("Could not approve this member — you may only approve staff in your own branch.");

  revalidatePath("/settings/branches");

  void createNotification(supabase, {
    orgId: context.profile.org_id,
    userId: memberId,
    type: "member_approved",
    title: "Your account has been approved",
    body: "You now have access to your branch.",
    entityType: "profile",
    entityId: memberId,
  });

  await logAudit({
    orgId: context.profile.org_id,
    actorId: context.profile.id,
    actorName: context.actorName,
    actorRole: context.actorRole,
    action: "user.approved",
    module: "Branch Staff",
    entityType: "profile",
    entityId: memberId,
    entityLabel: `${member.first_name} ${member.last_name}`,
    newValue: { approvedBy: context.profile.id, approvedAt: now },
  });
}

export async function rejectBranchStaff(memberId: string, reason?: string) {
  const supabase = await createClient();
  const context = await resolveBranchStaffContext(supabase, { allowManager: true });

  const { data: member } = await supabase
    .from("profiles")
    .select("org_id, first_name, last_name, status")
    .eq("id", memberId)
    .single();
  if (!member || member.org_id !== context.profile.org_id) throw new Error("Member not found.");
  if (member.status !== "awaiting_approval") throw new Error("This member isn't awaiting approval.");

  const fullReason = reason?.trim() || "Not approved";
  const { error } = await supabase
    .from("profiles")
    .update({ rejected_at: new Date().toISOString(), rejected_reason: fullReason })
    .eq("id", memberId)
    .eq("org_id", context.profile.org_id);
  if (error) throw new Error("Could not reject this member — you may only decide staff in your own branch.");

  revalidatePath("/settings/branches");

  void createNotification(supabase, {
    orgId: context.profile.org_id,
    userId: memberId,
    type: "member_rejected",
    title: "Your account request was not approved",
    body: fullReason,
    entityType: "profile",
    entityId: memberId,
  });

  await logAudit({
    orgId: context.profile.org_id,
    actorId: context.profile.id,
    actorName: context.actorName,
    actorRole: context.actorRole,
    action: "user.rejected",
    module: "Branch Staff",
    entityType: "profile",
    entityId: memberId,
    entityLabel: `${member.first_name} ${member.last_name}`,
    newValue: { reason: fullReason },
  });
}

export async function removeBranchStaff(memberId: string) {
  const supabase = await createClient();
  const context = await resolveBranchStaffContext(supabase);

  const { data: member } = await supabase.from("profiles").select("org_id, first_name, last_name").eq("id", memberId).single();
  if (!member || member.org_id !== context.profile.org_id) throw new Error("Member not found.");

  await removeBranchStaffForContext(supabase, context, memberId);
  revalidatePath("/settings/branches");

  await logAudit({
    orgId: context.profile.org_id,
    actorId: context.profile.id,
    actorName: context.actorName,
    actorRole: context.actorRole,
    action: "user.removed",
    module: "Branch Staff",
    entityType: "profile",
    entityId: memberId,
    entityLabel: `${member.first_name} ${member.last_name}`,
  });
}
