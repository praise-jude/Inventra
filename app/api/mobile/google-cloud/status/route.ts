import { NextRequest, NextResponse } from "next/server";
import { authenticateMobileRequest, mobileErrorResponse } from "@/lib/mobile-auth";
import { getGoogleCloudStatus } from "@/lib/google-cloud/storage";

// Mobile equivalent of web Settings → Integrations' Cloud Storage status
// card — a mobile bundle can never hold the service-role key needed to
// check the bucket itself, so this proxies the same getGoogleCloudStatus()
// web's page.tsx calls directly.
export async function GET(req: NextRequest) {
  const auth = await authenticateMobileRequest(req);
  if (auth instanceof NextResponse) return auth;

  try {
    const status = await getGoogleCloudStatus();
    return NextResponse.json(status);
  } catch (err) {
    return mobileErrorResponse(err, "Could not check Cloud Storage status.");
  }
}
