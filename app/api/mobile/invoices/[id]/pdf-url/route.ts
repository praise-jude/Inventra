import { NextRequest, NextResponse } from "next/server";
import { authenticateMobileRequest, mobileErrorResponse } from "@/lib/mobile-auth";
import { invoicePdfStoragePath } from "@/lib/invoice-pdf-storage-path";
import { isGoogleCloudConfigured } from "@/lib/google-cloud/config";
import { fileExists, getSignedReadUrl } from "@/lib/google-cloud/storage";

// Mobile equivalent of web's getInvoicePdfArchiveUrl server action.
// Always returns { url: null } rather than an error when there's nothing
// archived yet or Cloud Storage isn't configured — this is a "bonus"
// retrieval path, not a hard requirement for the invoice detail screen.
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authenticateMobileRequest(req);
  if (auth instanceof NextResponse) return auth;
  const { id } = await params;

  if (!isGoogleCloudConfigured()) {
    return NextResponse.json({ url: null });
  }

  try {
    const {
      data: { user },
    } = await auth.supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    const { data: profile } = await auth.supabase.from("profiles").select("org_id").eq("id", user.id).single();
    if (!profile) return NextResponse.json({ error: "No profile" }, { status: 400 });

    const path = invoicePdfStoragePath(profile.org_id, id);
    if (!(await fileExists(path))) return NextResponse.json({ url: null });

    const url = await getSignedReadUrl(path, 10);
    return NextResponse.json({ url });
  } catch (err) {
    return mobileErrorResponse(err, "Could not check for the cloud copy.");
  }
}
