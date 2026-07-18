import { NextRequest, NextResponse } from "next/server";
import { resolveAdminBillingContext, reactivateSubscriptionForContext } from "@/lib/billing-service";
import { authenticateMobileRequest, mobileErrorResponse } from "@/lib/mobile-auth";

// Mobile equivalent of reactivateSubscription (lib/actions/billing.ts).
export async function POST(req: NextRequest) {
  const auth = await authenticateMobileRequest(req);
  if (auth instanceof NextResponse) return auth;

  try {
    const { profile, subscription } = await resolveAdminBillingContext(auth.supabase);
    await reactivateSubscriptionForContext(auth.supabase, { profile, subscription });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return mobileErrorResponse(err, "Could not reactivate subscription.");
  }
}
