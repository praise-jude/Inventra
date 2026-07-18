import "server-only";
import { NextResponse, type NextRequest } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Shared bearer-token auth for the app/api/mobile/* route handlers — the
// Expo app has no cookies to authenticate a Next.js session with, so each
// mobile route accepts the caller's Supabase access token as a Bearer
// header instead and builds an RLS-scoped client from it, same as
// app/api/mobile/billing/initiate-card/route.ts originally did inline.
// Centralized here so every mobile billing route uses identical
// auth/error-shape behavior rather than four copies of the same boilerplate.
export async function authenticateMobileRequest(
  req: NextRequest,
): Promise<{ supabase: SupabaseClient } | NextResponse> {
  const authHeader = req.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice("Bearer ".length) : null;
  if (!token) {
    return NextResponse.json({ error: "Missing bearer token." }, { status: 401 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: `Bearer ${token}` } } },
  );

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser(token);
  if (authError || !user) {
    return NextResponse.json({ error: "Invalid or expired session." }, { status: 401 });
  }

  return { supabase };
}

export function mobileErrorResponse(err: unknown, fallback: string): NextResponse {
  const message = err instanceof Error ? err.message : fallback;
  const status = message === "Not authenticated" ? 401 : message.toLowerCase().includes("owner or admin") ? 403 : 400;
  return NextResponse.json({ error: message }, { status });
}
