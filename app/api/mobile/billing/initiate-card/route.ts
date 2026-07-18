import { NextRequest, NextResponse } from "next/server";
import { resolveAdminBillingContext, initiateAddCardForContext } from "@/lib/billing-service";
import { authenticateMobileRequest, mobileErrorResponse } from "@/lib/mobile-auth";

// Mobile equivalent of initiateAddCard (lib/actions/billing.ts). Next.js
// Server Actions only work from inside a Next.js-rendered page, so the Expo
// app can't call that directly — this route does the same job for a bearer-
// token-authenticated caller instead of a cookie session. The actual
// Paystack calls live in lib/billing-service.ts, shared with the web path,
// so there is exactly one implementation of "how we talk to Paystack" no
// matter which client is asking.
export async function POST(req: NextRequest) {
  const auth = await authenticateMobileRequest(req);
  if (auth instanceof NextResponse) return auth;

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

  try {
    const { profile, subscription } = await resolveAdminBillingContext(auth.supabase);
    const result = await initiateAddCardForContext({ profile, subscription }, planKey);
    return NextResponse.json(result);
  } catch (err) {
    return mobileErrorResponse(err, "Could not start card setup.");
  }
}
