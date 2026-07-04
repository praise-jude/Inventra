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
  } else if (path === "/login" || path === "/signup") {
    // Already authenticated — bounce to the app.
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
