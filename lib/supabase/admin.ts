import "server-only";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

// Deliberately untyped (matches lib/supabase/server.ts) — the placeholder
// `Database = Record<string, unknown>` shape doesn't model real tables, so
// passing it as a generic here only broke `.insert()`/`.update()` inference
// without adding any real safety.
export function createAdminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}
