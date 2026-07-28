import { NextRequest, NextResponse } from "next/server";
import { authenticateMobileRequest, mobileErrorResponse } from "@/lib/mobile-auth";
import { invoicePdfStoragePath } from "@/lib/invoice-pdf-storage-path";
import { uploadFile } from "@/lib/google-cloud/storage";

// Mobile equivalent of web's archiveInvoicePdf server action — the Expo
// app generates the same customer-invoice PDF locally (expo-print) and
// shares it via the OS share sheet already; this just also best-effort
// archives that same file to Cloud Storage afterward. Never blocks or
// replaces the existing local share flow if this fails. Body is the raw
// PDF bytes (src/lib/actions/invoices.ts's archiveInvoicePdf sends an
// ArrayBuffer directly), not multipart form data.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authenticateMobileRequest(req);
  if (auth instanceof NextResponse) return auth;
  const { id } = await params;

  const arrayBuffer = await req.arrayBuffer();
  if (arrayBuffer.byteLength === 0) {
    return NextResponse.json({ error: "No file provided." }, { status: 400 });
  }

  try {
    const {
      data: { user },
    } = await auth.supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    const { data: profile } = await auth.supabase.from("profiles").select("org_id").eq("id", user.id).single();
    if (!profile) return NextResponse.json({ error: "No profile" }, { status: 400 });

    await uploadFile({
      path: invoicePdfStoragePath(profile.org_id, id),
      data: Buffer.from(arrayBuffer),
      contentType: "application/pdf",
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return mobileErrorResponse(err, "Could not archive the invoice PDF.");
  }
}
