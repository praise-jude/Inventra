import { NextRequest, NextResponse } from "next/server";
import { disableMfaWithPasswordForContext } from "@/lib/mfa-service";
import { authenticateMobileRequest, mobileErrorResponse } from "@/lib/mobile-auth";

// Mobile equivalent of disableMfaWithPassword (lib/actions/mfa.ts).
export async function POST(req: NextRequest) {
  const auth = await authenticateMobileRequest(req);
  if (auth instanceof NextResponse) return auth;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }
  const { password, code } = body as { password?: unknown; code?: unknown };
  if (typeof password !== "string" || typeof code !== "string") {
    return NextResponse.json({ error: "Missing password or code." }, { status: 400 });
  }

  try {
    await disableMfaWithPasswordForContext(auth.supabase, { password, code });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return mobileErrorResponse(err, "Could not disable two-factor authentication.");
  }
}
