import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const AUTH_ROUTES = [
  "/login",
  "/signup",
  "/forgot-password",
  "/reset-password",
  "/accept-invite",
  "/auth/callback",
  "/terms",
  "/privacy",
  "/api-docs",
];

const ONBOARDING_ROUTE = "/onboarding/complete";
const ONBOARDING_PLAN_ROUTE = "/onboarding/plan";
const BILLING_ROUTE = "/billing";
const SUBSCRIPTION_REQUIRED_ROUTE = "/subscription-required";
// Platform-admin dashboard (requirePlatformAdmin() in lib/queries/session.ts
// does the real, server-side authorization check) — exempt from org-scoped
// onboarding/subscription gating entirely, since it's cross-org and must
// stay reachable regardless of the admin's own org's billing state.
const ADMIN_ROUTE = "/admin";
const BLOCKED_STATUSES = ["past_due", "payment_failed", "cancelled", "expired", "suspended"];

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

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  const isAuthRoute = AUTH_ROUTES.some((r) => path.startsWith(r));

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
  const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  const needsMfaStepUp = aal?.nextLevel === "aal2" && aal.nextLevel !== aal.currentLevel;
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
    // One round trip instead of three (profiles -> organizations ->
    // subscriptions) — get_access_gate_state() left-joins all three so this
    // check, which runs on every single authenticated navigation, doesn't
    // chain sequential requests. See supabase/migrations/20260711090000_access_gate_rpc.sql.
    const { data: gate } = await supabase.rpc("get_access_gate_state");

    // Make sure signup/OAuth onboarding gaps (business country/currency,
    // terms acceptance) are filled in before letting the user any further
    // into the app.
    let needsOnboarding = !gate?.profile_exists || !gate.terms_accepted;
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

    // Subscription gate — only once the terms/country onboarding above has
    // passed. Three states: still needs to add a card (new trial signups),
    // blocked (trial/subscription expired or in a failed-payment state), or
    // neither (normal access).
    if (!needsOnboarding) {
      const isOnboardingPlanCallback = path === `${ONBOARDING_PLAN_ROUTE}/callback`;
      const isOnboardingPlanRoute = path.startsWith(ONBOARDING_PLAN_ROUTE) && !isOnboardingPlanCallback;
      const isExemptFromBlock = path.startsWith(BILLING_ROUTE) || path === SUBSCRIPTION_REQUIRED_ROUTE;
      const awaitingCard = gate?.subscription_status === "trialing" && !gate.trial_ends_at;

      if (isOnboardingPlanCallback) {
        // Always let this through — it's the Paystack redirect target for
        // both the initial trial setup and later "update card" calls from
        // an already-onboarded org, and it redirects itself once done.
      } else if (awaitingCard) {
        if (!isOnboardingPlanRoute) {
          const url = request.nextUrl.clone();
          url.pathname = ONBOARDING_PLAN_ROUTE;
          return NextResponse.redirect(url);
        }
      } else if (isOnboardingPlanRoute) {
        // Card already on file — nothing left to do on this route.
        const url = request.nextUrl.clone();
        url.pathname = "/dashboard";
        return NextResponse.redirect(url);
      } else {
        const trialExpired =
          gate?.subscription_status === "trialing" && !!gate.trial_ends_at && new Date(gate.trial_ends_at) < new Date();
        const blocked = trialExpired || (!!gate?.subscription_status && BLOCKED_STATUSES.includes(gate.subscription_status));

        if (blocked && !isExemptFromBlock) {
          const url = request.nextUrl.clone();
          url.pathname = SUBSCRIPTION_REQUIRED_ROUTE;
          return NextResponse.redirect(url);
        }
        if (!blocked && path === SUBSCRIPTION_REQUIRED_ROUTE) {
          const url = request.nextUrl.clone();
          url.pathname = "/dashboard";
          return NextResponse.redirect(url);
        }
      }
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
