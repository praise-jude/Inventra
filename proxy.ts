import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  // api/ is excluded: the Paystack webhook and cron routes authenticate
  // themselves (signature / bearer secret) and have no Supabase user
  // session to check — running the auth/onboarding/subscription gate
  // against them would just redirect every call to /login.
  matcher: ["/((?!api/|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
