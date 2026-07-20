import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { authenticateApiRequest, apiErrorResponse } from "@/lib/api-auth";

const MAX_LIMIT = 100;
const DEFAULT_LIMIT = 25;

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

export async function GET(req: NextRequest) {
  const auth = await authenticateApiRequest(req, "products:read");
  if (auth instanceof NextResponse) return auth;

  const { searchParams } = new URL(req.url);
  const limit = Math.min(MAX_LIMIT, Math.max(1, Number(searchParams.get("limit")) || DEFAULT_LIMIT));
  const offset = Math.max(0, Number(searchParams.get("offset")) || 0);

  const admin = createAdminClient();
  const { data, error, count } = await admin
    .from("products")
    .select(PRODUCT_SELECT, { count: "exact" })
    .eq("org_id", auth.orgId)
    .is("archived_at", null)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);
  if (error) return apiErrorResponse(error, "Could not load products.", 500);

  return NextResponse.json({
    data: (data ?? []).map(mapProduct),
    pagination: { limit, offset, total: count ?? 0 },
  });
}

export async function POST(req: NextRequest) {
  const auth = await authenticateApiRequest(req, "products:write");
  if (auth instanceof NextResponse) return auth;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return apiErrorResponse(null, "Request body must be valid JSON.", 400);
  }

  const name = typeof body.name === "string" ? body.name.trim() : "";
  const sku = typeof body.sku === "string" ? body.sku.trim() : "";
  if (!name) return apiErrorResponse(null, "'name' is required.", 422);
  if (!sku) return apiErrorResponse(null, "'sku' is required.", 422);

  const costPrice = Number(body.costPrice ?? 0);
  const sellPrice = Number(body.sellPrice ?? 0);
  const reorderLevel = Number(body.reorderLevel ?? 0);
  if ([costPrice, sellPrice, reorderLevel].some((n) => !Number.isFinite(n) || n < 0)) {
    return apiErrorResponse(null, "'costPrice', 'sellPrice', and 'reorderLevel' must be non-negative numbers.", 422);
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("products")
    .insert({
      org_id: auth.orgId,
      name,
      sku,
      description: typeof body.description === "string" ? body.description : null,
      brand: typeof body.brand === "string" ? body.brand : null,
      barcode: typeof body.barcode === "string" ? body.barcode : null,
      unit: typeof body.unit === "string" && body.unit ? body.unit : "each",
      cost_price: costPrice,
      sell_price: sellPrice,
      reorder_level: reorderLevel,
      category_id: typeof body.categoryId === "string" ? body.categoryId : null,
      supplier_id: typeof body.supplierId === "string" ? body.supplierId : null,
      warehouse_id: typeof body.warehouseId === "string" ? body.warehouseId : null,
      qty_on_hand: 0,
    })
    .select(PRODUCT_SELECT)
    .single();
  if (error) {
    if (error.code === "23505") return apiErrorResponse(null, "A product with this SKU or barcode already exists.", 409);
    return apiErrorResponse(error, "Could not create the product.", 500);
  }

  return NextResponse.json({ data: mapProduct(data) }, { status: 201 });
}
