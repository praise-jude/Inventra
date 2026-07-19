import { NextRequest, NextResponse } from "next/server";
import { generateAndStoreRecoveryCodesForContext } from "@/lib/mfa-service";
import { authenticateMobileRequest, mobileErrorResponse } from "@/lib/mobile-auth";

// Mobile equivalent of generateAndStoreRecoveryCodes (lib/actions/mfa.ts).
// Called right after enroll/challenge/verify, which mobile does directly
// via supabase.auth.mfa.* (no route needed for that part).
export async function POST(req: NextRequest) {
  const auth = await authenticateMobileRequest(req);
  if (auth instanceof NextResponse) return auth;

  try {
    const codes = await generateAndStoreRecoveryCodesForContext(auth.supabase);
    return NextResponse.json({ codes });
  } catch (err) {
    return mobileErrorResponse(err, "Could not generate recovery codes.");
  }
}
