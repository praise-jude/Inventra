import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const AUTH_ROUTES = [
  "/login",
  "/signup",
  "/forgot-password",
  "/reset-password",
  "/accept-invite",
  "/mfa-setup",
  "/mfa-challenge",
  "/auth/callback",
  "/terms",
  "/privacy",
];

const ONBOARDING_ROUTE = "/onboarding/complete";

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

  // User is authenticated — enforce MFA before letting them reach the app.
  const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();

  if (!isAuthRoute) {
    if (aal && aal.currentLevel !== aal.nextLevel) {
      const url = request.nextUrl.clone();
      url.pathname = aal.nextLevel === "aal2" ? "/mfa-challenge" : "/mfa-setup";
      return NextResponse.redirect(url);
    }

    const { data: factors } = await supabase.auth.mfa.listFactors();
    const hasVerifiedFactor = (factors?.totp ?? []).some((f) => f.status === "verified");
    if (!hasVerifiedFactor) {
      const url = request.nextUrl.clone();
      url.pathname = "/mfa-setup";
      return NextResponse.redirect(url);
    }

    // MFA satisfied — make sure signup/OAuth onboarding gaps (business
    // country/currency, terms acceptance) are filled in before letting the
    // user any further into the app.
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
  } else if (path === "/login" || path === "/signup") {
    // Already fully authenticated (aal2 or no MFA required) — bounce to the app.
    if (!aal || aal.currentLevel === aal.nextLevel) {
      const url = request.nextUrl.clone();
      url.pathname = "/dashboard";
      return NextResponse.redirect(url);
    }
  }

  return supabaseResponse;
}
