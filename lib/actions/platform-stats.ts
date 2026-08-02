"use server";

import { createClient } from "@supabase/supabase-js";

// Fire-and-forget click tracking for the Android APK download button — the
// only "write" this codebase's public marketing pages do. Not behind
// auth, so it uses the same plain anon-key client as
// lib/queries/platform-stats.ts's read side rather than the cookie-based
// server client.
export async function recordApkDownload(): Promise<void> {
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
  const { error } = await supabase.rpc("increment_platform_download", { p_platform: "android" });
  if (error) console.error("[Inventra] recordApkDownload failed:", error);
}
