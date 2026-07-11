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
];

const ONBOARDING_ROUTE = "/onboarding/complete";
const ONBOARDING_PLAN_ROUTE = "/onboarding/plan";
const BILLING_ROUTE = "/billing";
const SUBSCRIPTION_REQUIRED_ROUTE = "/subscription-required";
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

  if (!isAuthRoute) {
    // Make sure signup/OAuth onboarding gaps (business country/currency,
    // terms acceptance) are filled in before letting the user any further
    // into the app.
    const { data: profileRow } = await supabase
      .from("profiles")
      .select("org_id, terms_accepted")
      .eq("id", user.id)
      .single();
    let needsOnboarding = !profileRow || !profileRow.terms_accepted;
    if (profileRow && profileRow.terms_accepted) {
      const { data: orgRow } = await supabase
        .from("organizations")
        .select("country")
        .eq("id", profileRow.org_id)
        .single();
      needsOnboarding = !orgRow?.country;
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
      const { data: sub } = await supabase
        .from("subscriptions")
        .select("status, trial_ends_at, cancel_at_period_end")
        .eq("org_id", profileRow!.org_id)
        .single();

      const isOnboardingPlanCallback = path === `${ONBOARDING_PLAN_ROUTE}/callback`;
      const isOnboardingPlanRoute = path.startsWith(ONBOARDING_PLAN_ROUTE) && !isOnboardingPlanCallback;
      const isExemptFromBlock = path.startsWith(BILLING_ROUTE) || path === SUBSCRIPTION_REQUIRED_ROUTE;
      const awaitingCard = sub?.status === "trialing" && !sub.trial_ends_at;

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
        const trialExpired = sub?.status === "trialing" && !!sub.trial_ends_at && new Date(sub.trial_ends_at) < new Date();
        const blocked = trialExpired || (!!sub?.status && BLOCKED_STATUSES.includes(sub.status));

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
  } else if (path === "/login" || path === "/signup") {
    // Already authenticated — bounce to the app.
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
