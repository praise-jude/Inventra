import { NextRequest, NextResponse } from "next/server";
import { resolveAdminBillingContext, cancelSubscriptionForContext } from "@/lib/billing-service";
import { authenticateMobileRequest, mobileErrorResponse } from "@/lib/mobile-auth";

// Mobile equivalent of cancelSubscription (lib/actions/billing.ts).
export async function POST(req: NextRequest) {
  const auth = await authenticateMobileRequest(req);
  if (auth instanceof NextResponse) return auth;

  try {
    const { profile, subscription } = await resolveAdminBillingContext(auth.supabase);
    await cancelSubscriptionForContext(auth.supabase, { profile, subscription });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return mobileErrorResponse(err, "Could not cancel subscription.");
  }
}
