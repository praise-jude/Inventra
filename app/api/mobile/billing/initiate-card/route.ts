import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { resolveAdminBillingContext, initiateAddCardForContext } from "@/lib/billing-service";

// Mobile equivalent of initiateAddCard (lib/actions/billing.ts). Next.js
// Server Actions only work from inside a Next.js-rendered page, so the Expo
// app can't call that directly — this route does the same job for a bearer-
// token-authenticated caller instead of a cookie session. The actual
// Paystack calls live in lib/billing-service.ts, shared with the web path,
// so there is exactly one implementation of "how we talk to Paystack" no
// matter which client is asking.
export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice("Bearer ".length) : null;
  if (!token) {
    return NextResponse.json({ error: "Missing bearer token." }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }
  const planKey = (body as { planKey?: unknown })?.planKey;
  if (planKey !== "monthly" && planKey !== "yearly") {
    return NextResponse.json({ error: "Invalid plan." }, { status: 400 });
  }

  // Attaching the caller's JWT as the Authorization header (rather than
  // using the anon key alone) means every subsequent query runs under the
  // same RLS policies a signed-in user's request would — identical scoping
  // to the cookie-session path, just via a bearer token instead of a cookie.
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

  try {
    const { profile, subscription } = await resolveAdminBillingContext(supabase);
    const result = await initiateAddCardForContext({ profile, subscription }, planKey);
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not start card setup.";
    const status = message === "Not authenticated" ? 401 : message.includes("owner or admin") ? 403 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
