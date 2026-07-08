import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Shared exchange endpoint for every auth flow that hands back a `code`:
// Google OAuth, team invites, and password-reset emails all redirect here
// first so the session is established server-side (cookies set) before the
// browser ever renders a page — like /accept-invite — that assumes one.
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/dashboard";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(`${origin}${next}`);
  }

  // Code missing, expired, or already used — send the user back to the
  // flow's own page (so it can show a friendly "link expired" message)
  // rather than dropping them on /login with no context.
  const fallback = next === "/dashboard" ? "/login" : next;
  return NextResponse.redirect(`${origin}${fallback}?error=expired`);
}
