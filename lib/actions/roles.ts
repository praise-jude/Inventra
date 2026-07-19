"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { logAudit } from "@/lib/actions/audit";
import type { CustomizableRole } from "@/lib/permissions";

// Roles are Admin-tier only to edit — role_permissions_write_admin RLS
// already enforces this, but checking here first gives a clear error
// instead of a silent no-op.
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
  if (!["owner", "admin"].includes(profile.role)) {
    throw new Error("Only an owner or admin can manage role permissions.");
  }
  return {
    supabase,
    orgId: profile.org_id as string,
    userId: user.id,
    role: profile.role as string,
    actorName: `${profile.first_name} ${profile.last_name}`,
  };
}

export async function updateRolePermission(role: CustomizableRole, module: string, action: string, allowed: boolean) {
  const { supabase, orgId, userId, role: actorRole, actorName } = await requireAdminOrgId();

  const { error } = await supabase.from("role_permissions").upsert(
    {
      org_id: orgId,
      role,
      module,
      action,
      allowed,
      updated_by: userId,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "org_id,role,module,action" },
  );
  if (error) {
    console.error("[Inventra] updateRolePermission failed:", error);
    throw new Error("Could not update this permission.");
  }
  revalidatePath("/settings/roles");

  await logAudit({
    orgId,
    actorId: userId,
    actorName,
    actorRole,
    action: "role_permission.updated",
    module: "Settings",
    entityType: "role_permissions",
    entityLabel: `${role}: ${module}.${action}`,
    newValue: { role, module, action, allowed },
  });
}

export async function resetRolePermission(role: CustomizableRole, module: string, action: string) {
  const { supabase, orgId, userId, role: actorRole, actorName } = await requireAdminOrgId();

  const { error } = await supabase
    .from("role_permissions")
    .delete()
    .eq("org_id", orgId)
    .eq("role", role)
    .eq("module", module)
    .eq("action", action);
  if (error) {
    console.error("[Inventra] resetRolePermission failed:", error);
    throw new Error("Could not reset this permission.");
  }
  revalidatePath("/settings/roles");

  await logAudit({
    orgId,
    actorId: userId,
    actorName,
    actorRole,
    action: "role_permission.reset",
    module: "Settings",
    entityType: "role_permissions",
    entityLabel: `${role}: ${module}.${action}`,
  });
}
