import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

const WINDOW_MINUTES = 15;
const MAX_ATTEMPTS = 5;

// Generic version of the checkAndRecordRateLimit pattern already used by
// signup (lib/actions/auth.ts) and MFA recovery codes (lib/mfa-service.ts) —
// those two keep their own dedicated tables since they predate this helper
// and work fine as-is; this backs any new call site via one shared table
// (rate_limit_attempts) keyed by an arbitrary bucket name, so login/
// password-reset/MFA-verify don't each need their own migration.
//
// Only the service-role admin client can read/write rate_limit_attempts
// (RLS has no policies for anon/authenticated) — this can never be checked
// or tampered with from the browser being rate-limited. Note this only
// protects requests that go through this app's own Server Actions; it does
// not stop someone calling the Supabase Auth REST API directly with the
// public anon key — that requires Supabase's own project-level Auth rate
// limits and/or a CAPTCHA challenge, configured outside this codebase.
export async function checkAndRecordRateLimit(bucket: string, key: string): Promise<boolean> {
  const admin = createAdminClient();
  const since = new Date(Date.now() - WINDOW_MINUTES * 60_000).toISOString();
  const { count } = await admin
    .from("rate_limit_attempts")
    .select("id", { count: "exact", head: true })
    .eq("bucket", bucket)
    .eq("key", key)
    .gte("created_at", since);
  if ((count ?? 0) >= MAX_ATTEMPTS) return false;

  await admin.from("rate_limit_attempts").insert({ bucket, key });

  // Pure housekeeping with no bearing on this attempt's outcome — fire
  // without awaiting so it can't add latency to every check.
  const pruneCutoff = new Date(Date.now() - 24 * 60 * 60_000).toISOString();
  admin
    .from("rate_limit_attempts")
    .delete()
    .eq("bucket", bucket)
    .eq("key", key)
    .lt("created_at", pruneCutoff)
    .then(({ error }) => {
      if (error) console.error("[Inventra] rate_limit_attempts prune failed:", error);
    });

  return true;
}
