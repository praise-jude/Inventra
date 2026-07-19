import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

export interface CreateNotificationInput {
  orgId: string;
  userId: string;
  type: string;
  title: string;
  body?: string;
  entityType?: string;
  entityId?: string;
}

// Fire-and-forget by design, same reasoning as logAudit — a failed
// notification insert must never break the mutation it's describing.
// Called from whichever session already triggered the event (a Server
// Action's cookie session, a mobile bearer-scoped client, or the
// not-yet-approved member's own session in accept-invite/page.tsx), so
// `supabase` here is never the admin client — RLS's notifications_insert_org
// policy is the real gate.
export async function createNotification(supabase: SupabaseClient, input: CreateNotificationInput): Promise<void> {
  try {
    const { error } = await supabase.from("notifications").insert({
      org_id: input.orgId,
      user_id: input.userId,
      type: input.type,
      title: input.title,
      body: input.body ?? null,
      entity_type: input.entityType ?? null,
      entity_id: input.entityId ?? null,
    });
    if (error) {
      console.error("[Inventra] createNotification failed:", error);
      return;
    }
    await sendPushNotification(supabase, input.userId, input.title, input.body);
  } catch (err) {
    console.error("[Inventra] createNotification threw:", err);
  }
}

// Expo's push endpoint needs no API key for this volume — just the
// recipient's push token(s). Never throws; a missing/expired token (the
// user never opened the mobile app, or uninstalled it) should never break
// the in-app notification that was already written above.
async function sendPushNotification(supabase: SupabaseClient, userId: string, title: string, body?: string): Promise<void> {
  try {
    const { data: tokens } = await supabase.from("push_tokens").select("token").eq("user_id", userId);
    if (!tokens || tokens.length === 0) return;

    await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(tokens.map((t) => ({ to: t.token, title, body: body ?? "", sound: "default" }))),
    });
  } catch (err) {
    console.error("[Inventra] sendPushNotification failed:", err);
  }
}
