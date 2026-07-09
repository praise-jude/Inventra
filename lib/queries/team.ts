import "server-only";
import { createClient } from "@/lib/supabase/server";

export interface TeamMemberRow {
  id: string;
  name: string;
  email: string;
  role: string;
  status: string;
  suspendedAt: string | null;
  initials: string;
  lastActive: string | null;
  branchName: string | null;
}

export async function getTeamMembers(): Promise<TeamMemberRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    // profiles has two FKs to warehouses (warehouses.manager_profile_id and
    // this table's own branch_id) — PostgREST can't infer which one to embed
    // without the explicit !constraint hint, and errors with PGRST201.
    .select("id, first_name, last_name, email, role, status, suspended_at, last_active_at, warehouses!profiles_branch_id_fkey(name)")
    .order("created_at", { ascending: true });
  if (error) {
    console.error("[Inventra] getTeamMembers failed:", error);
    throw new Error("Could not load team members. Please try again.");
  }
  return (data ?? []).map((p) => ({
    id: p.id,
    name: `${p.first_name} ${p.last_name}`,
    email: p.email,
    role: p.role,
    status: p.status,
    suspendedAt: p.suspended_at ?? null,
    initials: `${p.first_name[0] ?? ""}${p.last_name[0] ?? ""}`.toUpperCase(),
    lastActive: p.last_active_at,
    branchName: (p.warehouses as unknown as { name: string } | null)?.name ?? null,
  }));
}
