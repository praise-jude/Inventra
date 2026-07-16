"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ADMIN_ROLES } from "@/lib/roles";
import { logAudit } from "@/lib/actions/audit";
import { siteUrl } from "@/lib/site-url";
import { sendMemberApprovedEmail } from "@/lib/email";

// Mirrors the check inviteMember already did — Team Management is Admin-tier
// only (owner/admin). Returns the acting profile so callers can guard
// self-action / last-owner cases.
async function requireAdminOrgId() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  const { data: profile } = await supabase
    .from("profiles")
    .select("org_id, role, first_name, last_name")
    .eq("id", user.id)
    .single();
  if (!profile) throw new Error("No profile");
  if (!ADMIN_ROLES.includes(profile.role)) {
    throw new Error("Only an owner or admin can manage team members.");
  }
  return {
    supabase,
    orgId: profile.org_id as string,
    userId: user.id,
    role: profile.role as string,
    actorName: `${profile.first_name} ${profile.last_name}`,
  };
}

async function assertNotLastOwner(supabase: Awaited<ReturnType<typeof createClient>>, orgId: string, memberId: string) {
  const { data: member } = await supabase.from("profiles").select("role").eq("id", memberId).single();
  if (member?.role !== "owner") return;
  const { count } = await supabase
    .from("profiles")
    .select("id", { count: "exact", head: true })
    .eq("org_id", orgId)
    .eq("role", "owner");
  if ((count ?? 0) <= 1) throw new Error("This is the only owner — promote another member to owner first.");
}

export async function inviteMember(email: string, role: string, firstName: string, lastName: string, branchId: string) {
  const { orgId, userId, role: actorRole, actorName } = await requireAdminOrgId();

  if (!branchId) throw new Error("Pick a branch for this member.");

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error(
      "Invites need the SUPABASE_SERVICE_ROLE_KEY server secret — add it to the deployment's environment (Supabase dashboard → Project Settings → API).",
    );
  }
  const admin = createAdminClient();
  const { error } = await admin.auth.admin.inviteUserByEmail(email, {
    data: { org_id: orgId, role, first_name: firstName, last_name: lastName, branch_id: branchId },
    redirectTo: `${await siteUrl()}/auth/callback?next=/accept-invite`,
  });
  if (error) {
    console.error("[Inventra] inviteMember failed:", { email, orgId, error });
    throw new Error("Could not send the invite email. Please try again in a moment.");
  }

  revalidatePath("/team");

  await logAudit({
    orgId,
    actorId: userId,
    actorName,
    actorRole: actorRole,
    action: "user.invited",
    module: "Team",
    entityType: "profile",
    entityLabel: `${firstName} ${lastName} (${email})`,
    newValue: { email, role, branchId },
  });
}

export async function resendInvite(memberId: string) {
  const { orgId, userId, role: actorRole, actorName } = await requireAdminOrgId();
  const supabase = await createClient();
  const { data: member } = await supabase
    .from("profiles")
    .select("email, role, first_name, last_name, status, branch_id")
    .eq("id", memberId)
    .eq("org_id", orgId)
    .single();
  if (!member) throw new Error("Member not found.");
  if (member.status !== "invited") throw new Error("This member has already accepted their invite.");

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("Invites need the SUPABASE_SERVICE_ROLE_KEY server secret configured.");
  }
  const admin = createAdminClient();
  const { error } = await admin.auth.admin.inviteUserByEmail(member.email, {
    data: { org_id: orgId, role: member.role, first_name: member.first_name, last_name: member.last_name, branch_id: member.branch_id },
    redirectTo: `${await siteUrl()}/auth/callback?next=/accept-invite`,
  });
  if (error) {
    console.error("[Inventra] resendInvite failed:", { memberId, orgId, error });
    throw new Error("Could not resend the invite email. Please try again in a moment.");
  }
  revalidatePath("/team");

  await logAudit({
    orgId,
    actorId: userId,
    actorName,
    actorRole,
    action: "user.invite_resent",
    module: "Team",
    entityType: "profile",
    entityId: memberId,
    entityLabel: `${member.first_name} ${member.last_name} (${member.email})`,
  });
}

export async function updateMemberRole(memberId: string, role: string) {
  const { supabase, orgId, userId, role: actorRole, actorName } = await requireAdminOrgId();
  if (memberId === userId) throw new Error("You can't change your own role.");
  await assertNotLastOwner(supabase, orgId, memberId);

  const { data: before } = await supabase.from("profiles").select("role, first_name, last_name").eq("id", memberId).maybeSingle();

  const { error } = await supabase.from("profiles").update({ role }).eq("id", memberId).eq("org_id", orgId);
  if (error) {
    console.error("[Inventra] updateMemberRole failed:", { memberId, orgId, error });
    throw new Error("Could not update this member's role.");
  }
  revalidatePath("/team");

  await logAudit({
    orgId,
    actorId: userId,
    actorName,
    actorRole,
    action: "user.role_changed",
    module: "Team",
    entityType: "profile",
    entityId: memberId,
    entityLabel: before ? `${before.first_name} ${before.last_name}` : memberId,
    previousValue: { role: before?.role ?? null },
    newValue: { role },
  });
}

export async function suspendMember(memberId: string) {
  const { supabase, orgId, userId, role: actorRole, actorName } = await requireAdminOrgId();
  if (memberId === userId) throw new Error("You can't suspend your own account.");
  await assertNotLastOwner(supabase, orgId, memberId);

  const { data: member } = await supabase.from("profiles").select("first_name, last_name").eq("id", memberId).maybeSingle();

  const { error } = await supabase
    .from("profiles")
    .update({ suspended_at: new Date().toISOString() })
    .eq("id", memberId)
    .eq("org_id", orgId);
  if (error) {
    console.error("[Inventra] suspendMember failed:", { memberId, orgId, error });
    throw new Error("Could not suspend this member.");
  }
  revalidatePath("/team");

  await logAudit({
    orgId,
    actorId: userId,
    actorName,
    actorRole,
    action: "user.suspended",
    module: "Team",
    entityType: "profile",
    entityId: memberId,
    entityLabel: member ? `${member.first_name} ${member.last_name}` : memberId,
  });
}

export async function reactivateMember(memberId: string) {
  const { supabase, orgId, userId, role: actorRole, actorName } = await requireAdminOrgId();

  const { data: member } = await supabase.from("profiles").select("first_name, last_name").eq("id", memberId).maybeSingle();

  const { error } = await supabase
    .from("profiles")
    .update({ suspended_at: null })
    .eq("id", memberId)
    .eq("org_id", orgId);
  if (error) {
    console.error("[Inventra] reactivateMember failed:", { memberId, orgId, error });
    throw new Error("Could not reactivate this member.");
  }
  revalidatePath("/team");

  await logAudit({
    orgId,
    actorId: userId,
    actorName,
    actorRole,
    action: "user.reactivated",
    module: "Team",
    entityType: "profile",
    entityId: memberId,
    entityLabel: member ? `${member.first_name} ${member.last_name}` : memberId,
  });
}

export async function removeMember(memberId: string) {
  const { supabase, orgId, userId, role: actorRole, actorName } = await requireAdminOrgId();
  if (memberId === userId) throw new Error("You can't remove your own account.");
  await assertNotLastOwner(supabase, orgId, memberId);

  const { data: member } = await supabase.from("profiles").select("org_id, first_name, last_name").eq("id", memberId).single();
  if (!member || member.org_id !== orgId) throw new Error("Member not found.");

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("Removing members needs the SUPABASE_SERVICE_ROLE_KEY server secret configured.");
  }
  const admin = createAdminClient();
  const { error } = await admin.auth.admin.deleteUser(memberId);
  if (error) {
    console.error("[Inventra] removeMember failed:", { memberId, orgId, error });
    throw new Error("Could not remove this member.");
  }
  revalidatePath("/team");

  await logAudit({
    orgId,
    actorId: userId,
    actorName,
    actorRole,
    action: "user.removed",
    module: "Team",
    entityType: "profile",
    entityId: memberId,
    entityLabel: `${member.first_name} ${member.last_name}`,
  });
}

export const REJECT_REASONS = ["Wrong branch", "Duplicate account", "Invalid invitation", "Other"] as const;

export async function approveMember(memberId: string) {
  const { supabase, orgId, userId, role: actorRole, actorName } = await requireAdminOrgId();

  const { data: member } = await supabase
    .from("profiles")
    .select("org_id, first_name, last_name, email, status")
    .eq("id", memberId)
    .single();
  if (!member || member.org_id !== orgId) throw new Error("Member not found.");
  if (member.status !== "awaiting_approval") throw new Error("This member isn't awaiting approval.");

  const now = new Date().toISOString();
  const { error } = await supabase
    .from("profiles")
    .update({ status: "active", approved_by: userId, approved_at: now })
    .eq("id", memberId)
    .eq("org_id", orgId);
  if (error) {
    console.error("[Inventra] approveMember failed:", { memberId, orgId, error });
    throw new Error("Could not approve this member.");
  }
  revalidatePath("/team");

  const { data: org } = await supabase.from("organizations").select("name").eq("id", orgId).single();
  void sendMemberApprovedEmail({ to: member.email, orgName: org?.name ?? "your workspace" }).catch(() => {});

  await logAudit({
    orgId,
    actorId: userId,
    actorName,
    actorRole,
    action: "user.approved",
    module: "Team",
    entityType: "profile",
    entityId: memberId,
    entityLabel: `${member.first_name} ${member.last_name}`,
    newValue: { approvedBy: userId, approvedAt: now },
  });
}

export async function rejectMember(memberId: string, reason: (typeof REJECT_REASONS)[number], detail?: string) {
  const { supabase, orgId, userId, role: actorRole, actorName } = await requireAdminOrgId();

  const { data: member } = await supabase
    .from("profiles")
    .select("org_id, first_name, last_name, status")
    .eq("id", memberId)
    .single();
  if (!member || member.org_id !== orgId) throw new Error("Member not found.");
  if (member.status !== "awaiting_approval") throw new Error("This member isn't awaiting approval.");

  const fullReason = reason === "Other" && detail?.trim() ? detail.trim() : reason;
  const { error } = await supabase
    .from("profiles")
    .update({ rejected_at: new Date().toISOString(), rejected_reason: fullReason })
    .eq("id", memberId)
    .eq("org_id", orgId);
  if (error) {
    console.error("[Inventra] rejectMember failed:", { memberId, orgId, error });
    throw new Error("Could not reject this member.");
  }
  revalidatePath("/team");

  await logAudit({
    orgId,
    actorId: userId,
    actorName,
    actorRole,
    action: "user.rejected",
    module: "Team",
    entityType: "profile",
    entityId: memberId,
    entityLabel: `${member.first_name} ${member.last_name}`,
    newValue: { reason: fullReason },
  });
}
