import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { authenticateApiRequest, apiErrorResponse } from "@/lib/api-auth";

const MAX_LIMIT = 100;
const DEFAULT_LIMIT = 25;

export async function GET(req: NextRequest) {
  const auth = await authenticateApiRequest(req, "customers:read");
  if (auth instanceof NextResponse) return auth;

  const { searchParams } = new URL(req.url);
  const limit = Math.min(MAX_LIMIT, Math.max(1, Number(searchParams.get("limit")) || DEFAULT_LIMIT));
  const offset = Math.max(0, Number(searchParams.get("offset")) || 0);

  const admin = createAdminClient();
  const { data, error, count } = await admin
    .from("customers")
    .select("id, name, phone, email, created_at", { count: "exact" })
    .eq("org_id", auth.orgId)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);
  if (error) return apiErrorResponse(error, "Could not load customers.", 500);

  return NextResponse.json({
    data: (data ?? []).map((c) => ({ id: c.id, name: c.name, phone: c.phone, email: c.email, createdAt: c.created_at })),
    pagination: { limit, offset, total: count ?? 0 },
  });
}
