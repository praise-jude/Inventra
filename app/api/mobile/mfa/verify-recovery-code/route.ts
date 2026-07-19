import { NextRequest, NextResponse } from "next/server";
import { verifyRecoveryCodeForContext } from "@/lib/mfa-service";
import { authenticateMobileRequest, mobileErrorResponse } from "@/lib/mobile-auth";

// Mobile equivalent of verifyRecoveryCode (lib/actions/mfa.ts) — used at
// login-time step-up when the user picks "use a recovery code" instead of
// a TOTP code. The caller only has an AAL1 session at this point (password
// verified, second factor pending), which authenticateMobileRequest still
// accepts since it only validates the JWT, not the AAL.
export async function POST(req: NextRequest) {
  const auth = await authenticateMobileRequest(req);
  if (auth instanceof NextResponse) return auth;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }
  const code = (body as { code?: unknown })?.code;
  if (typeof code !== "string") {
    return NextResponse.json({ error: "Missing code." }, { status: 400 });
  }

  try {
    const valid = await verifyRecoveryCodeForContext(auth.supabase, code);
    return NextResponse.json({ valid });
  } catch (err) {
    return mobileErrorResponse(err, "Could not verify this recovery code.");
  }
}
