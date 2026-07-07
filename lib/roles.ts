import type { UserRole } from "@/lib/supabase/database.types";

// Single source of truth for the v2.1 Admin/Manager/Staff role tiers —
// previously each of session.ts, Sidebar.tsx, and dashboard/page.tsx
// re-typed its own ["owner","admin"] / ["owner","admin","manager"] array.
// "Staff" (cashier, warehouse) is simply "everything not in these two".
export const ADMIN_ROLES: UserRole[] = ["owner", "admin"];
export const MANAGER_ROLES: UserRole[] = ["owner", "admin", "manager"];

export function isAdminRole(role: UserRole | string): boolean {
  return (ADMIN_ROLES as string[]).includes(role);
}

export function isManagerRole(role: UserRole | string): boolean {
  return (MANAGER_ROLES as string[]).includes(role);
}
