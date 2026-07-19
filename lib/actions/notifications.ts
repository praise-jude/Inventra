"use server";

import { createClient } from "@/lib/supabase/server";
import { MANAGER_ROLES } from "@/lib/roles";
import { createNotification } from "@/lib/notifications-service";

export interface NotificationRow {
  id: string;
  type: string;
  title: string;
  body: string | null;
  entityType: string | null;
  entityId: string | null;
  readAt: string | null;
  createdAt: string;
}

export async function getNotifications(): Promise<NotificationRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("notifications")
    .select("id, type, title, body, entity_type, entity_id, read_at, created_at")
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) {
    console.error("[Inventra] getNotifications failed:", error);
    throw new Error("Could not load notifications.");
  }
  return (data ?? []).map((n) => ({
    id: n.id,
    type: n.type,
    title: n.title,
    body: n.body,
    entityType: n.entity_type,
    entityId: n.entity_id,
    readAt: n.read_at,
    createdAt: n.created_at,
  }));
}

export async function getUnreadNotificationCount(): Promise<number> {
  const supabase = await createClient();
  const { count, error } = await supabase.from("notifications").select("id", { count: "exact", head: true }).is("read_at", null);
  if (error) {
    console.error("[Inventra] getUnreadNotificationCount failed:", error);
    return 0;
  }
  return count ?? 0;
}

export async function markNotificationRead(id: string): Promise<void> {
  const supabase = await createClient();
  await supabase.from("notifications").update({ read_at: new Date().toISOString() }).eq("id", id);
}

export async function markAllNotificationsRead(): Promise<void> {
  const supabase = await createClient();
  await supabase.from("notifications").update({ read_at: new Date().toISOString() }).is("read_at", null);
}

// Called from accept-invite/page.tsx right after the caller's own
// self-accept status update — only notifies if that update actually
// resulted in awaiting_approval (an Admin-invited member skips straight to
// active via guard_profile_status_transitions() and has nothing to
// notify). Runs as the newly-accepted (not yet approved) member's own
// session — notifications_insert_org's RLS check only requires the
// recipient to be same-org, not that the inserter is already approved.
export async function notifyPendingApproval(): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const { data: profile } = await supabase.from("profiles").select("org_id, first_name, last_name, status").eq("id", user.id).single();
  if (!profile || profile.status !== "awaiting_approval") return;

  const { data: approvers } = await supabase.from("profiles").select("id").eq("org_id", profile.org_id).in("role", MANAGER_ROLES);
  if (!approvers) return;

  const name = `${profile.first_name} ${profile.last_name}`;
  await Promise.all(
    approvers.map((a) =>
      createNotification(supabase, {
        orgId: profile.org_id,
        userId: a.id,
        type: "pending_approval",
        title: `${name} needs your approval`,
        body: "They've accepted their invite and are waiting to be approved.",
        entityType: "profile",
        entityId: user.id,
      }),
    ),
  );
}
