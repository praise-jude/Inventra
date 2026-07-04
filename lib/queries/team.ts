import "server-only";
import { createClient } from "@/lib/supabase/server";

export interface TeamMemberRow {
  id: string;
  name: string;
  email: string;
  role: string;
  status: string;
  initials: string;
  lastActive: string | null;
}

export async function getTeamMembers(): Promise<TeamMemberRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("id, first_name, last_name, email, role, status, last_active_at")
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
    initials: `${p.first_name[0] ?? ""}${p.last_name[0] ?? ""}`.toUpperCase(),
    lastActive: p.last_active_at,
  }));
}
