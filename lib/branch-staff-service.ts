import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { ADMIN_ROLES, MANAGER_ROLES } from "@/lib/roles";
import { createAdminClient } from "@/lib/supabase/admin";
import { siteUrl } from "@/lib/site-url";

// Branch Staff: the narrower, branch-scoped replacement for the old Team
// Management invite flow (removed entirely in favor of branch-code
// self-service signup for Managers — see
// supabase/migrations/20260803200000_branch_code_signup.sql). This restores
// just enough of that removed flow to give a Manager a way to bring
// Cashier/Warehouse staff onto their OWN branch, since branch-code signup
// deliberately only ever creates Manager accounts. Unlike old Team
// Management: no role changes, no suspend/reactivate, no inviting
// Admin/Owner — those stay gone.
//
// The underlying DB mechanism (handle_new_user()'s org_id branch,
// guard_profile_status_transitions(), profiles_update_manager_approval RLS)
// was never removed, only the application layer that exercised it — see
// 20260716160000_team_approval_workflow.sql and
// 20260801140000_branch_scoped_manager_approval.sql. A Manager-invited
// member lands in awaiting_approval (guard_profile_status_transitions()
// checks invited_by_role), approvable by that same branch's Manager(s) or
// any Admin/Owner; an Admin/Owner-invited member skips straight to active.
const MANAGER_INVITABLE_ROLES = ["cashier", "warehouse"];
const ADMIN_INVITABLE_ROLES = ["admin", "manager", "cashier", "warehouse"];

export interface BranchStaffProfile {
  id: string;
  org_id: string;
  role: string;
  branch_id: string | null;
}

export interface BranchStaffContext {
  profile: BranchStaffProfile;
  actorName: string;
  actorRole: string;
}

// Shared by lib/actions/branch-staff.ts (web Server Actions) and
// app/api/mobile/branch-staff/invite (mobile route handler) — same
// "resolve the authenticated actor" pattern lib/team-service.ts used to
// have. allowManager widens this from Admin/Owner to also accept
// Manager-tier callers, since a Manager can invite Staff to their own
// branch.
export async function resolveBranchStaffContext(
  supabase: SupabaseClient,
  opts: { allowManager?: boolean } = {},
): Promise<BranchStaffContext> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, org_id, role, branch_id, first_name, last_name")
    .eq("id", user.id)
    .single();
  if (!profile) throw new Error("No profile");
  const allowedRoles = opts.allowManager ? MANAGER_ROLES : ADMIN_ROLES;
  if (!allowedRoles.includes(profile.role)) {
    throw new Error("Only an owner, admin, or manager can manage branch staff.");
  }
  return {
    profile: { id: profile.id, org_id: profile.org_id, role: profile.role, branch_id: profile.branch_id },
    actorName: `${profile.first_name} ${profile.last_name}`,
    actorRole: profile.role,
  };
}

export interface InviteBranchStaffInput {
  email: string;
  role: string;
  firstName: string;
  lastName: string;
  branchId: string;
}

// The one thing a mobile bundle can never do itself (needs the
// service-role key) — mirrors the old inviteMemberForContext, plus a
// branch-ownership check that original never had: a Manager may only
// invite into their OWN branch, not any branch in the org.
export async function inviteBranchStaffForContext(
  { profile, actorRole }: BranchStaffContext,
  input: InviteBranchStaffInput,
): Promise<void> {
  if (!input.branchId) throw new Error("Pick a branch for this member.");
  if (actorRole === "manager") {
    if (!MANAGER_INVITABLE_ROLES.includes(input.role)) {
      throw new Error("Managers can only invite Cashier or Warehouse staff.");
    }
    if (!profile.branch_id || profile.branch_id !== input.branchId) {
      throw new Error("You can only invite staff to your own branch.");
    }
  } else if (!ADMIN_INVITABLE_ROLES.includes(input.role)) {
    throw new Error("That role can't be invited here.");
  }
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error(
      "Invites need the SUPABASE_SERVICE_ROLE_KEY server secret — add it to the deployment's environment (Supabase dashboard → Project Settings → API).",
    );
  }
  const admin = createAdminClient();
  const { error } = await admin.auth.admin.inviteUserByEmail(input.email, {
    data: {
      org_id: profile.org_id,
      role: input.role,
      first_name: input.firstName,
      last_name: input.lastName,
      branch_id: input.branchId,
      invited_by: profile.id,
      invited_by_role: actorRole,
    },
    redirectTo: `${await siteUrl()}/auth/callback?next=/accept-invite`,
  });
  if (error) {
    console.error("[Inventra] inviteBranchStaff failed:", { email: input.email, orgId: profile.org_id, error });
    // Supabase Auth emails are unique project-wide, not per-org — this
    // email already has an account somewhere (this org or another one),
    // so no amount of retrying will make inviteUserByEmail succeed.
    if (error.code === "email_exists") {
      throw new Error("This email is already registered to an account and can't be invited here.");
    }
    throw new Error("Could not send the invite email. Please try again in a moment.");
  }
}

// Admin/Owner only (mirrors old resendInviteForContext) — a Manager can
// invite but can't resend; they'd just send a fresh invite instead.
export async function resendBranchStaffInviteForContext(
  supabase: SupabaseClient,
  { profile }: BranchStaffContext,
  memberId: string,
): Promise<void> {
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
    console.error("[Inventra] resendBranchStaffInvite failed:", { memberId, orgId: profile.org_id, error });
    // Supabase Auth's inviteUserByEmail isn't idempotent — resending to an
    // email that already has a pending (unconfirmed) invite comes back as
    // "already registered" rather than actually resending, so retrying
    // this action specifically will never succeed.
    if (error.code === "email_exists") {
      throw new Error("Could not resend — this invite is still pending. Ask them to check their email (including spam), or remove and re-invite if the link expired.");
    }
    throw new Error("Could not resend the invite email. Please try again in a moment.");
  }
}

// Admin/Owner only — removing a person from the org outright, distinct
// from rejecting a still-pending request (rejectBranchStaff in
// lib/actions/branch-staff.ts, a plain RLS-scoped table write).
export async function removeBranchStaffForContext(
  supabase: SupabaseClient,
  { profile }: BranchStaffContext,
  memberId: string,
): Promise<void> {
  if (memberId === profile.id) throw new Error("You can't remove your own account.");

  const { data: member } = await supabase.from("profiles").select("org_id, role").eq("id", memberId).single();
  if (!member || member.org_id !== profile.org_id) throw new Error("Member not found.");
  if (member.role === "owner") throw new Error("Owners can't be removed here.");

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("Removing staff needs the SUPABASE_SERVICE_ROLE_KEY server secret configured.");
  }
  const admin = createAdminClient();
  const { error } = await admin.auth.admin.deleteUser(memberId);
  if (error) {
    console.error("[Inventra] removeBranchStaff failed:", { memberId, orgId: profile.org_id, error });
    // AuthRetryableFetchError specifically means the request to Supabase's
    // Auth server itself failed (network/transport), not that removal was
    // rejected — worth telling the caller retrying might actually work,
    // unlike the email_exists cases above.
    if (error.name === "AuthRetryableFetchError") {
      throw new Error("Could not reach the server to remove this member. Please try again in a moment.");
    }
    throw new Error("Could not remove this member.");
  }
}
