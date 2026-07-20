import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { authenticateApiRequest, apiErrorResponse } from "@/lib/api-auth";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authenticateApiRequest(req, "sales:read");
  if (auth instanceof NextResponse) return auth;
  const { id } = await params;

  const admin = createAdminClient();
  const { data: sale, error } = await admin
    .from("sales")
    .select("id, customer_id, walk_in_name, warehouse_id, subtotal, discount_amount, tax_amount, total, notes, created_at")
    .eq("id", id)
    .eq("org_id", auth.orgId)
    .maybeSingle();
  if (error) return apiErrorResponse(error, "Could not load this sale.", 500);
  if (!sale) return apiErrorResponse(null, "Sale not found.", 404);

  const [{ data: items }, { data: payments }] = await Promise.all([
    admin.from("stock_movements").select("id, product_id, qty_delta, unit_price").eq("sale_id", id),
    admin.from("sale_payments").select("id, method, amount").eq("sale_id", id),
  ]);

  return NextResponse.json({
    data: {
      id: sale.id,
      customerId: sale.customer_id,
      walkInName: sale.walk_in_name,
      warehouseId: sale.warehouse_id,
      subtotal: Number(sale.subtotal),
      discountAmount: Number(sale.discount_amount),
      taxAmount: Number(sale.tax_amount),
      total: Number(sale.total),
      notes: sale.notes,
      createdAt: sale.created_at,
      items: (items ?? []).map((i) => ({
        id: i.id,
        productId: i.product_id,
        qty: Math.abs(i.qty_delta),
        unitPrice: i.unit_price !== null ? Number(i.unit_price) : null,
      })),
      payments: (payments ?? []).map((p) => ({ id: p.id, method: p.method, amount: Number(p.amount) })),
    },
  });
}
