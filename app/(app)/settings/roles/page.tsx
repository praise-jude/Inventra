import { requireAdminProfile } from "@/lib/queries/session";
import { createClient } from "@/lib/supabase/server";
import {
  CUSTOMIZABLE_ROLES,
  PERMISSION_MODULES,
  MODULE_ACTIONS,
  DEFAULT_PERMISSIONS,
  ACTION_LABELS,
  MODULE_LABELS,
  type CustomizableRole,
} from "@/lib/permissions";
import { RolesClient, type RoleMatrixModule } from "@/components/settings/RolesClient";

export default async function RolesSettingsPage() {
  const { profile } = await requireAdminProfile();
  const supabase = await createClient();

  const { data: overrides } = await supabase
    .from("role_permissions")
    .select("role, module, action, allowed")
    .eq("org_id", profile.org_id);

  const overrideMap = new Map((overrides ?? []).map((o) => [`${o.role}:${o.module}:${o.action}`, o.allowed as boolean]));

  const modules: RoleMatrixModule[] = PERMISSION_MODULES.map((mod) => ({
    module: mod,
    label: MODULE_LABELS[mod],
    actions: MODULE_ACTIONS[mod].map((action) => ({
      action,
      label: ACTION_LABELS[action] ?? action,
      cells: CUSTOMIZABLE_ROLES.map((role: CustomizableRole) => {
        const key = `${role}:${mod}:${action}`;
        const override = overrideMap.get(key);
        const value = override ?? DEFAULT_PERMISSIONS[role][mod][action];
        return { role, value, isOverride: override !== undefined };
      }),
    })),
  }));

  return (
    <div>
      <div className="mb-4 text-[13px] text-text-2">
        Fine-tune what Manager, Cashier, and Warehouse accounts can do beyond their default access. Changes apply
        immediately, org-wide, on both web and mobile.
      </div>
      <RolesClient modules={modules} />
    </div>
  );
}
