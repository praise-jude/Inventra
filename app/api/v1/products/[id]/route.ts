import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { authenticateApiRequest, apiErrorResponse } from "@/lib/api-auth";

const PRODUCT_SELECT =
  "id, sku, barcode, name, description, brand, unit, cost_price, sell_price, reorder_level, qty_on_hand, status, is_active, expiry_date, category_id, supplier_id, warehouse_id, created_at, updated_at";

function mapProduct(p: Record<string, unknown>) {
  return {
    id: p.id,
    sku: p.sku,
    barcode: p.barcode,
    name: p.name,
    description: p.description,
    brand: p.brand,
    unit: p.unit,
    costPrice: Number(p.cost_price),
    sellPrice: Number(p.sell_price),
    reorderLevel: p.reorder_level,
    qtyOnHand: p.qty_on_hand,
    status: p.status,
    isActive: p.is_active,
    expiryDate: p.expiry_date,
    categoryId: p.category_id,
    supplierId: p.supplier_id,
    warehouseId: p.warehouse_id,
    createdAt: p.created_at,
    updatedAt: p.updated_at,
  };
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authenticateApiRequest(req, "products:read");
  if (auth instanceof NextResponse) return auth;
  const { id } = await params;

  const admin = createAdminClient();
  const { data, error } = await admin.from("products").select(PRODUCT_SELECT).eq("id", id).eq("org_id", auth.orgId).maybeSingle();
  if (error) return apiErrorResponse(error, "Could not load this product.", 500);
  if (!data) return apiErrorResponse(null, "Product not found.", 404);

  return NextResponse.json({ data: mapProduct(data) });
}
