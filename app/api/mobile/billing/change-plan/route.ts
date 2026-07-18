import { NextRequest, NextResponse } from "next/server";
import { resolveAdminBillingContext, changePlanForContext } from "@/lib/billing-service";
import { authenticateMobileRequest, mobileErrorResponse } from "@/lib/mobile-auth";

// Mobile equivalent of changePlan (lib/actions/billing.ts) — same
// bearer-token pattern as initiate-card/route.ts, sharing the exact plan-
// change logic in lib/billing-service.ts with the web Server Action.
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
    await changePlanForContext(auth.supabase, { profile, subscription }, planKey);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return mobileErrorResponse(err, "Could not change plan.");
  }
}
