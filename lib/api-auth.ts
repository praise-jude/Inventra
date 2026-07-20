import "server-only";
import crypto from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { ApiScope } from "@/lib/api-scopes";

export type { ApiScope } from "@/lib/api-scopes";
export { ALL_API_SCOPES } from "@/lib/api-scopes";

const RATE_LIMIT_WINDOW_SECONDS = 60;
const RATE_LIMIT_MAX_REQUESTS = 60;

export function hashApiKey(key: string): string {
  return crypto.createHash("sha256").update(key).digest("hex");
}

export interface ApiAuthContext {
  orgId: string;
  apiKeyId: string;
  scopes: ApiScope[];
}

// Bearer-API-key auth for app/api/v1/* — mirrors lib/mobile-auth.ts's
// authenticateMobileRequest shape (returns either a resolved context or a
// ready-to-return NextResponse), but keys are a wholly separate mechanism
// from Supabase Auth sessions: no auth.uid(), so route handlers use the
// service-role client and filter by the returned orgId explicitly rather
// than relying on RLS.
export async function authenticateApiRequest(req: NextRequest, requiredScope: ApiScope): Promise<ApiAuthContext | NextResponse> {
  const authHeader = req.headers.get("authorization");
  const key = authHeader?.startsWith("Bearer ") ? authHeader.slice("Bearer ".length) : null;
  if (!key) {
    return NextResponse.json({ error: "Missing bearer API key. Send it as 'Authorization: Bearer <key>'." }, { status: 401 });
  }

  const admin = createAdminClient();
  const keyHash = hashApiKey(key);
  const { data: apiKey } = await admin.from("api_keys").select("id, org_id, scopes, revoked_at").eq("key_hash", keyHash).maybeSingle();

  if (!apiKey || apiKey.revoked_at) {
    return NextResponse.json({ error: "Invalid or revoked API key." }, { status: 401 });
  }

  const scopes = (apiKey.scopes ?? []) as ApiScope[];
  if (!scopes.includes(requiredScope)) {
    return NextResponse.json({ error: `This API key does not have the '${requiredScope}' scope.` }, { status: 403 });
  }

  // check_and_log_api_request() does the count-check and the usage-log
  // insert atomically, serialized per-key via pg_advisory_xact_lock — a
  // plain "select count, then insert" from here raced under concurrent
  // requests (confirmed live: 70 requests fired via Promise.all all
  // returned 200, zero 429s, since every request's count query ran before
  // any of the others' inserts had committed).
  const path = new URL(req.url).pathname;
  const { data: allowed, error: rateLimitError } = await admin.rpc("check_and_log_api_request", {
    p_api_key_id: apiKey.id,
    p_method: req.method,
    p_path: path,
    p_window_seconds: RATE_LIMIT_WINDOW_SECONDS,
    p_max_requests: RATE_LIMIT_MAX_REQUESTS,
  });
  if (rateLimitError) {
    return NextResponse.json({ error: "Could not verify rate limit. Please try again." }, { status: 500 });
  }
  if (!allowed) {
    return NextResponse.json({ error: `Rate limit exceeded (${RATE_LIMIT_MAX_REQUESTS}/min). Try again shortly.` }, { status: 429 });
  }

  void admin.from("api_keys").update({ last_used_at: new Date().toISOString() }).eq("id", apiKey.id);

  return { orgId: apiKey.org_id, apiKeyId: apiKey.id, scopes };
}

export function apiErrorResponse(err: unknown, fallback: string, status = 400): NextResponse {
  const message = err instanceof Error ? err.message : fallback;
  return NextResponse.json({ error: message }, { status });
}
