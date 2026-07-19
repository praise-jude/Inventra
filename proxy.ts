import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

// api/mobile/* is bearer-token authenticated (see lib/mobile-auth.ts), not
// cookie-session, so it never needs the Supabase auth-redirect gate below —
// but as the only cross-origin caller (the Expo app's web build runs on its
// own dev-server/hosting origin, not this one), it's the only api/ surface
// that needs CORS handling: a browser blocks the real POST entirely unless
// the OPTIONS preflight for it succeeds first. Native builds never hit this
// (no CORS enforcement outside a browser), which is why it went unnoticed
// until the web build was actually exercised end-to-end.
const MOBILE_API_PREFIX = "/api/mobile/";
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export async function proxy(request: NextRequest) {
  if (request.nextUrl.pathname.startsWith(MOBILE_API_PREFIX)) {
    if (request.method === "OPTIONS") {
      return new NextResponse(null, { status: 204, headers: corsHeaders });
    }
    const response = NextResponse.next();
    for (const [key, value] of Object.entries(corsHeaders)) response.headers.set(key, value);
    return response;
  }
  return updateSession(request);
}

export const config = {
  // api/ (minus api/mobile/, handled above) is excluded: the Paystack
  // webhook and cron routes authenticate themselves (signature / bearer
  // secret) and have no Supabase user session to check — running the
  // auth/onboarding/subscription gate against them would just redirect
  // every call to /login.
  matcher: ["/((?!api/(?!mobile/)|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
