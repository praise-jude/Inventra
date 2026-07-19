import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

// Thin wrapper around the has_permission() SQL function (see
// supabase/migrations/20260719120000_role_permissions.sql) — one round
// trip, throws a friendly error on false. Owner/Admin always pass;
// Manager/Cashier/Warehouse resolve against role_permissions overrides,
// falling back to today's real RLS/app-layer behavior when unmodified.
export async function requirePermission(supabase: SupabaseClient, module: string, action: string): Promise<void> {
  const { data, error } = await supabase.rpc("has_permission", { p_module: module, p_action: action });
  if (error) {
    console.error("[Inventra] has_permission RPC failed:", { module, action, error });
    throw new Error("Could not verify permissions. Please try again.");
  }
  if (!data) {
    throw new Error("You don't have permission to do that.");
  }
}

// Owner/Admin are never customizable (role_permissions_role_check enforces
// this at the DB layer too). Everything below mirrors has_permission()'s
// fallback branch exactly — the Settings > Roles matrix and its defaults
// must never drift from what the SQL function actually does.
export const CUSTOMIZABLE_ROLES = ["manager", "cashier", "warehouse"] as const;
export type CustomizableRole = (typeof CUSTOMIZABLE_ROLES)[number];

export const PERMISSION_MODULES = ["inventory", "sales", "reports"] as const;
export type PermissionModule = (typeof PERMISSION_MODULES)[number];

export const MODULE_ACTIONS = {
  inventory: ["create", "edit", "delete", "create_movement", "delete_movement"],
  sales: ["create", "edit", "delete"],
  reports: ["view"],
} as const satisfies Record<PermissionModule, readonly string[]>;
export type PermissionAction = (typeof MODULE_ACTIONS)[PermissionModule][number];

export const ACTION_LABELS: Record<string, string> = {
  create: "Create",
  edit: "Edit",
  delete: "Delete",
  create_movement: "Create stock movement",
  delete_movement: "Delete stock movement",
  view: "View",
};

export const MODULE_LABELS: Record<PermissionModule, string> = {
  inventory: "Inventory",
  sales: "Sales",
  reports: "Reports",
};

// Straight port of has_permission()'s fallback branch — what each role can
// do today with zero override rows.
export const DEFAULT_PERMISSIONS: Record<CustomizableRole, Record<PermissionModule, Record<string, boolean>>> = {
  manager: {
    inventory: { create: true, edit: true, delete: true, create_movement: true, delete_movement: true },
    sales: { create: true, edit: true, delete: true },
    reports: { view: true },
  },
  cashier: {
    inventory: { create: false, edit: false, delete: false, create_movement: true, delete_movement: false },
    sales: { create: true, edit: false, delete: false },
    reports: { view: false },
  },
  warehouse: {
    inventory: { create: false, edit: false, delete: false, create_movement: true, delete_movement: false },
    sales: { create: false, edit: false, delete: false },
    reports: { view: false },
  },
};
