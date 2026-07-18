import { NextRequest, NextResponse } from "next/server";
import { resolveAdminBillingContext, removePaymentMethodForContext } from "@/lib/billing-service";
import { authenticateMobileRequest, mobileErrorResponse } from "@/lib/mobile-auth";

// Mobile equivalent of removePaymentMethod (lib/actions/billing.ts).
export async function POST(req: NextRequest) {
  const auth = await authenticateMobileRequest(req);
  if (auth instanceof NextResponse) return auth;

  try {
    const { profile, subscription } = await resolveAdminBillingContext(auth.supabase);
    await removePaymentMethodForContext(auth.supabase, { profile, subscription });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return mobileErrorResponse(err, "Could not remove payment method.");
  }
}
