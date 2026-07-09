"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ADMIN_ROLES } from "@/lib/roles";
import { logAudit } from "@/lib/actions/audit";

async function siteUrl(): Promise<string> {
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL;
  const h = await headers();
  const host = h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "https";
  return `${proto}://${host}`;
}

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

export async function inviteMember(email: string, role: string, firstName: string, lastName: string) {
  const { orgId, userId, role: actorRole, actorName } = await requireAdminOrgId();

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error(
      "Invites need the SUPABASE_SERVICE_ROLE_KEY server secret — add it to the deployment's environment (Supabase dashboard → Project Settings → API).",
    );
  }
  const admin = createAdminClient();
  const { error } = await admin.auth.admin.inviteUserByEmail(email, {
    data: { org_id: orgId, role, first_name: firstName, last_name: lastName },
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
    newValue: { email, role },
  });
}

export async function resendInvite(memberId: string) {
  const { orgId } = await requireAdminOrgId();
  const supabase = await createClient();
  const { data: member } = await supabase
    .from("profiles")
    .select("email, role, first_name, last_name, status")
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
    data: { org_id: orgId, role: member.role, first_name: member.first_name, last_name: member.last_name },
    redirectTo: `${await siteUrl()}/auth/callback?next=/accept-invite`,
  });
  if (error) {
    console.error("[Inventra] resendInvite failed:", { memberId, orgId, error });
    throw new Error("Could not resend the invite email. Please try again in a moment.");
  }
  revalidatePath("/team");
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
