import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { authenticateApiRequest, apiErrorResponse } from "@/lib/api-auth";

const MAX_LIMIT = 100;
const DEFAULT_LIMIT = 25;

export async function GET(req: NextRequest) {
  const auth = await authenticateApiRequest(req, "sales:read");
  if (auth instanceof NextResponse) return auth;

  const { searchParams } = new URL(req.url);
  const limit = Math.min(MAX_LIMIT, Math.max(1, Number(searchParams.get("limit")) || DEFAULT_LIMIT));
  const offset = Math.max(0, Number(searchParams.get("offset")) || 0);
  const dateFrom = searchParams.get("dateFrom");
  const dateTo = searchParams.get("dateTo");

  const admin = createAdminClient();
  let query = admin
    .from("sales")
    .select("id, customer_id, walk_in_name, warehouse_id, subtotal, discount_amount, tax_amount, total, notes, created_at", { count: "exact" })
    .eq("org_id", auth.orgId)
    .order("created_at", { ascending: false });
  if (dateFrom) query = query.gte("created_at", dateFrom);
  if (dateTo) query = query.lte("created_at", dateTo);

  const { data, error, count } = await query.range(offset, offset + limit - 1);
  if (error) return apiErrorResponse(error, "Could not load sales.", 500);

  return NextResponse.json({
    data: (data ?? []).map((s) => ({
      id: s.id,
      customerId: s.customer_id,
      walkInName: s.walk_in_name,
      warehouseId: s.warehouse_id,
      subtotal: Number(s.subtotal),
      discountAmount: Number(s.discount_amount),
      taxAmount: Number(s.tax_amount),
      total: Number(s.total),
      notes: s.notes,
      createdAt: s.created_at,
    })),
    pagination: { limit, offset, total: count ?? 0 },
  });
}
