import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { ADMIN_ROLES } from "@/lib/roles";
import { createAdminClient } from "@/lib/supabase/admin";
import { siteUrl } from "@/lib/site-url";

// Narrowed to just what inviteMemberForContext/resendInviteForContext/
// removeMemberForContext actually use — role/name aren't needed here since
// resolveAdminTeamContext already validated the role before returning.
export interface AdminTeamProfile {
  id: string;
  org_id: string;
}

export interface AdminTeamContext {
  profile: AdminTeamProfile;
  // Only lib/actions/team.ts needs an audit trail today, and it already has
  // its own requireAdminOrgId() with this info — these two are here purely
  // for app/api/mobile/team/* (which has no other route to an actor's
  // display name) to log the same audit entries the web wrapper does,
  // without a second profiles round-trip.
  actorName: string;
  actorRole: string;
}

// Shared by lib/actions/team.ts (web Server Actions, cookie-session auth)
// and app/api/mobile/team/* (mobile route handlers, bearer-JWT auth) — same
// "resolve the authenticated org-admin" pattern as billing-service.ts's
// resolveAdminBillingContext.
export async function resolveAdminTeamContext(supabase: SupabaseClient): Promise<AdminTeamContext> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, org_id, role, first_name, last_name")
    .eq("id", user.id)
    .single();
  if (!profile) throw new Error("No profile");
  if (!ADMIN_ROLES.includes(profile.role)) {
    throw new Error("Only an owner or admin can manage team members.");
  }
  return { profile, actorName: `${profile.first_name} ${profile.last_name}`, actorRole: profile.role };
}

// The three team actions that need Supabase's Admin API (invite/delete
// auth.users rows) — the one thing a mobile bundle can never do itself,
// since that requires the service-role key. Everything else in team
// management (role changes, suspend/reactivate, approve/reject) is a plain
// RLS-scoped table write and doesn't need this file at all.

export async function inviteMemberForContext(
  { profile }: AdminTeamContext,
  input: { email: string; role: string; firstName: string; lastName: string; branchId: string },
): Promise<void> {
  if (!input.branchId) throw new Error("Pick a branch for this member.");
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error(
      "Invites need the SUPABASE_SERVICE_ROLE_KEY server secret — add it to the deployment's environment (Supabase dashboard → Project Settings → API).",
    );
  }
  const admin = createAdminClient();
  const { error } = await admin.auth.admin.inviteUserByEmail(input.email, {
    data: { org_id: profile.org_id, role: input.role, first_name: input.firstName, last_name: input.lastName, branch_id: input.branchId },
    redirectTo: `${await siteUrl()}/auth/callback?next=/accept-invite`,
  });
  if (error) {
    console.error("[Inventra] inviteMember failed:", { email: input.email, orgId: profile.org_id, error });
    throw new Error("Could not send the invite email. Please try again in a moment.");
  }
}

export async function resendInviteForContext(supabase: SupabaseClient, { profile }: AdminTeamContext, memberId: string): Promise<void> {
  const { data: member } = await supabase
    .from("profiles")
    .select("email, role, first_name, last_name, status, branch_id")
    .eq("id", memberId)
    .eq("org_id", profile.org_id)
    .single();
  if (!member) throw new Error("Member not found.");
  if (member.status !== "invited") throw new Error("This member has already accepted their invite.");

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("Invites need the SUPABASE_SERVICE_ROLE_KEY server secret configured.");
  }
  const admin = createAdminClient();
  const { error } = await admin.auth.admin.inviteUserByEmail(member.email, {
    data: { org_id: profile.org_id, role: member.role, first_name: member.first_name, last_name: member.last_name, branch_id: member.branch_id },
    redirectTo: `${await siteUrl()}/auth/callback?next=/accept-invite`,
  });
  if (error) {
    console.error("[Inventra] resendInvite failed:", { memberId, orgId: profile.org_id, error });
    throw new Error("Could not resend the invite email. Please try again in a moment.");
  }
}

export async function removeMemberForContext(supabase: SupabaseClient, { profile }: AdminTeamContext, memberId: string): Promise<void> {
  if (memberId === profile.id) throw new Error("You can't remove your own account.");

  const { data: member } = await supabase.from("profiles").select("org_id, role, first_name, last_name").eq("id", memberId).single();
  if (!member || member.org_id !== profile.org_id) throw new Error("Member not found.");
  if (member.role === "owner") {
    const { count } = await supabase.from("profiles").select("id", { count: "exact", head: true }).eq("org_id", profile.org_id).eq("role", "owner");
    if ((count ?? 0) <= 1) throw new Error("This is the only owner — promote another member to owner first.");
  }

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("Removing members needs the SUPABASE_SERVICE_ROLE_KEY server secret configured.");
  }
  const admin = createAdminClient();
  const { error } = await admin.auth.admin.deleteUser(memberId);
  if (error) {
    console.error("[Inventra] removeMember failed:", { memberId, orgId: profile.org_id, error });
    throw new Error("Could not remove this member.");
  }
}
