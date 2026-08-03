import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const AUTH_ROUTES = [
  "/login",
  "/signup",
  "/forgot-password",
  "/reset-password",
  "/auth/callback",
  "/terms",
  "/privacy",
  "/api-docs",
  // Must stay reachable regardless of auth/onboarding/subscription state —
  // Google Play requires the account-deletion link to work for logged-out
  // visitors and blocked/unpaid accounts alike, not just fully onboarded ones.
  "/delete-account",
  // The public APK download page — explicitly required to work without an
  // account ("never require a website account before downloading the
  // APK"). Was missing from this list since the page was first added, so
  // logged-out visitors were being redirected to /login instead.
  "/download",
];

const ONBOARDING_ROUTE = "/onboarding/complete";
// Platform-admin dashboard (requirePlatformAdmin() in lib/queries/session.ts
// does the real, server-side authorization check) — exempt from org-scoped
// onboarding gating entirely, since it's cross-org.
const ADMIN_ROUTE = "/admin";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // This middleware runs on every request to a protected route. An
  // uncaught exception here (a transient Supabase API hiccup, a network
  // blip) isn't caught by app/error.tsx or global-error.tsx the way a
  // page-render failure is — it fails the request outright, at the edge,
  // before the React tree even starts. Every protected page already does
  // its own auth check (requireProfile()/requireXProfile() in
  // lib/queries/session.ts) which IS covered by those error boundaries,
  // so on a transient failure here it's safer to fail open (let the
  // request through) than to crash every protected route uniformly.
  let user = null;
  try {
    const {
      data: { user: fetchedUser },
    } = await supabase.auth.getUser();
    user = fetchedUser;
  } catch (err) {
    console.error("[Inventra middleware] auth.getUser() failed:", err);
    return supabaseResponse;
  }

  const path = request.nextUrl.pathname;
  // Exact match (not startsWith) — "/" is the public marketing landing page
  // for logged-out visitors (see app/page.tsx), but must not swallow every
  // other route the way a prefix match would.
  const isAuthRoute = path === "/" || AUTH_ROUTES.some((r) => path.startsWith(r));

  if (!user) {
    if (!isAuthRoute) {
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      return NextResponse.redirect(url);
    }
    return supabaseResponse;
  }

  // Password auth alone sets a valid (AAL1) session cookie immediately —
  // without this check, a user with MFA enabled could skip the login
  // page's challenge screen entirely by navigating straight to a
  // protected route in a new tab right after entering their password.
  let needsMfaStepUp = false;
  try {
    const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    needsMfaStepUp = aal?.nextLevel === "aal2" && aal.nextLevel !== aal.currentLevel;
  } catch (err) {
    console.error("[Inventra middleware] mfa.getAuthenticatorAssuranceLevel() failed:", err);
  }
  if (needsMfaStepUp && path !== "/login") {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    // Signals the login page to open straight into the authenticator-code
    // screen — needed for any AAL1 session that never went through the
    // password form's own client-side step-up branch, e.g. Google OAuth,
    // which does a full-page round trip and remounts the page fresh.
    url.searchParams.set("mfa", "1");
    return NextResponse.redirect(url);
  }

  if (path.startsWith(ADMIN_ROUTE)) {
    return supabaseResponse;
  }

  if (!isAuthRoute) {
    // get_access_gate_state() left-joins profiles/organizations/
    // subscriptions in one round trip. See
    // supabase/migrations/20260711090000_access_gate_rpc.sql. A transient
    // failure here falls through without redirecting — requireProfile()
    // and the (onboarding) layout's own checks re-verify this server-side
    // on the actual page, this is just a fast-path redirect optimization.
    let gate: { profile_exists?: boolean; terms_accepted?: boolean; country?: string | null } | null = null;
    try {
      const { data } = await supabase.rpc("get_access_gate_state");
      gate = data;
    } catch (err) {
      console.error("[Inventra middleware] get_access_gate_state failed:", err);
    }

    // Make sure signup/OAuth onboarding gaps (business country/currency,
    // terms acceptance) are filled in before letting the user any further
    // into the app. This is the only forced gate left — Phase F retired
    // the mandatory card/trial/subscription-block gate that used to sit
    // here: every org now has full app access on the Free plan the moment
    // onboarding is complete, and Premium (lib/entitlements.ts) is a pure
    // opt-in upgrade with no forced redirect of its own. A lapsed Premium
    // subscription falls back to Free limits, it doesn't lock anyone out.
    let needsOnboarding = gate !== null && (!gate.profile_exists || !gate.terms_accepted);
    if (gate?.profile_exists && gate.terms_accepted) {
      needsOnboarding = !gate.country;
    }

    if (needsOnboarding && path !== ONBOARDING_ROUTE) {
      const url = request.nextUrl.clone();
      url.pathname = ONBOARDING_ROUTE;
      return NextResponse.redirect(url);
    }
    if (!needsOnboarding && path === ONBOARDING_ROUTE) {
      const url = request.nextUrl.clone();
      url.pathname = "/dashboard";
      return NextResponse.redirect(url);
    }
  } else if ((path === "/login" || path === "/signup") && !needsMfaStepUp) {
    // Already fully authenticated — bounce to the app. Skipped while an
    // MFA step-up is still pending, or this would infinite-loop against
    // the needsMfaStepUp redirect-to-/login above.
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
