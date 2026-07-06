"use server";

import { createClient } from "@/lib/supabase/server";

const HEARTBEAT_THROTTLE_SECONDS = 45;

// Cheap "I'm still here" ping the presence provider calls on a timer. The
// `.lt()` guard means most calls are a no-op write (no matching row) instead
// of an unconditional UPDATE on every heartbeat.
export async function touchLastSeen() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const cutoff = new Date(Date.now() - HEARTBEAT_THROTTLE_SECONDS * 1000).toISOString();
  await supabase
    .from("profiles")
    .update({ last_active_at: new Date().toISOString() })
    .eq("id", user.id)
    .or(`last_active_at.is.null,last_active_at.lt.${cutoff}`);
}
