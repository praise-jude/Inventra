"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getProductDetail, type ProductDetail } from "@/lib/queries/products";

export async function fetchProductDetail(id: string): Promise<ProductDetail | null> {
  return getProductDetail(id);
}

export interface CreateProductInput {
  name: string;
  description?: string;
  sku: string;
  categoryId?: string;
  unit: string;
  costPrice: number;
  sellPrice: number;
  reorderLevel: number;
  supplierId?: string;
  warehouseId?: string;
  openingQty: number;
}

export async function createProduct(input: CreateProductInput) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data: profile } = await supabase.from("profiles").select("org_id").eq("id", user.id).single();
  if (!profile) throw new Error("No profile");

  const { data: product, error } = await supabase
    .from("products")
    .insert({
      org_id: profile.org_id,
      name: input.name,
      description: input.description || null,
      sku: input.sku,
      category_id: input.categoryId || null,
      unit: input.unit || "each",
      cost_price: input.costPrice,
      sell_price: input.sellPrice,
      reorder_level: input.reorderLevel,
      supplier_id: input.supplierId || null,
      warehouse_id: input.warehouseId || null,
      qty_on_hand: 0,
    })
    .select("id")
    .single();
  if (error) throw error;

  if (input.openingQty > 0) {
    await supabase.from("stock_movements").insert({
      org_id: profile.org_id,
      product_id: product.id,
      warehouse_id: input.warehouseId || null,
      type: "received",
      qty_delta: input.openingQty,
      reason: "Opening stock",
      created_by: user.id,
    });
  }

  revalidatePath("/products");
  revalidatePath("/dashboard");
  return product.id as string;
}

export interface UpdateProductInput {
  name: string;
  description?: string;
  sku: string;
  categoryId?: string;
  unit: string;
  costPrice: number;
  sellPrice: number;
  reorderLevel: number;
  supplierId?: string;
  warehouseId?: string;
}

export async function updateProduct(id: string, input: UpdateProductInput) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("products")
    .update({
      name: input.name,
      description: input.description || null,
      sku: input.sku,
      category_id: input.categoryId || null,
      unit: input.unit || "each",
      cost_price: input.costPrice,
      sell_price: input.sellPrice,
      reorder_level: input.reorderLevel,
      supplier_id: input.supplierId || null,
      warehouse_id: input.warehouseId || null,
    })
    .eq("id", id);
  if (error) throw error;
  revalidatePath("/products");
  revalidatePath("/dashboard");
}

export interface ImportProductRow {
  name: string;
  sku: string;
  unit?: string;
  costPrice?: number;
  sellPrice?: number;
  reorderLevel?: number;
  openingQty?: number;
  category?: string;
  supplier?: string;
  warehouse?: string;
}

export interface ImportResult {
  created: number;
  skipped: { sku: string; reason: string }[];
}

export async function importProducts(rows: ImportProductRow[]): Promise<ImportResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  const { data: profile } = await supabase.from("profiles").select("org_id").eq("id", user.id).single();
  if (!profile) throw new Error("No profile");
  if (rows.length === 0) return { created: 0, skipped: [] };
  if (rows.length > 500) throw new Error("Import is limited to 500 rows at a time.");

  const [{ data: categories }, { data: suppliers }, { data: warehouses }] = await Promise.all([
    supabase.from("categories").select("id, name"),
    supabase.from("suppliers").select("id, name"),
    supabase.from("warehouses").select("id, name"),
  ]);
  const byName = (list: { id: string; name: string }[] | null, name?: string) =>
    name ? list?.find((x) => x.name.toLowerCase() === name.toLowerCase())?.id ?? null : null;

  const result: ImportResult = { created: 0, skipped: [] };
  for (const row of rows) {
    if (!row.name || !row.sku) {
      result.skipped.push({ sku: row.sku || "(blank)", reason: "missing name or SKU" });
      continue;
    }
    const { data: clash } = await supabase.from("products").select("id").eq("sku", row.sku).maybeSingle();
    if (clash) {
      result.skipped.push({ sku: row.sku, reason: "SKU already exists" });
      continue;
    }
    const { data: product, error } = await supabase
      .from("products")
      .insert({
        org_id: profile.org_id,
        name: row.name,
        sku: row.sku,
        unit: row.unit || "each",
        cost_price: row.costPrice ?? 0,
        sell_price: row.sellPrice ?? 0,
        reorder_level: row.reorderLevel ?? 0,
        category_id: byName(categories, row.category),
        supplier_id: byName(suppliers, row.supplier),
        warehouse_id: byName(warehouses, row.warehouse),
        qty_on_hand: 0,
      })
      .select("id")
      .single();
    if (error) {
      result.skipped.push({ sku: row.sku, reason: error.message });
      continue;
    }
    if ((row.openingQty ?? 0) > 0) {
      await supabase.from("stock_movements").insert({
        org_id: profile.org_id,
        product_id: product.id,
        warehouse_id: byName(warehouses, row.warehouse),
        type: "received",
        qty_delta: row.openingQty!,
        reason: "CSV import — opening stock",
        created_by: user.id,
      });
    }
    result.created++;
  }

  revalidatePath("/products");
  revalidatePath("/dashboard");
  return result;
}

export async function archiveProduct(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("products").update({ archived_at: new Date().toISOString() }).eq("id", id);
  if (error) throw error;
  revalidatePath("/products");
  revalidatePath("/dashboard");
}

export async function duplicateProduct(id: string) {
  const supabase = await createClient();
  const { data: original, error } = await supabase.from("products").select("*").eq("id", id).single();
  if (error) throw error;

  const {
    id: _id,
    created_at: _createdAt,
    updated_at: _updatedAt,
    status: _status,
    qty_on_hand: _qtyOnHand,
    qty_reserved: _qtyReserved,
    qty_damaged: _qtyDamaged,
    qty_returned: _qtyReturned,
    ...rest
  } = original;
  void _id;
  void _createdAt;
  void _updatedAt;
  void _status;
  void _qtyOnHand;
  void _qtyReserved;
  void _qtyDamaged;
  void _qtyReturned;

  let sku = `${rest.sku}-COPY`;
  for (let i = 1; i < 20; i++) {
    const { data: clash } = await supabase.from("products").select("id").eq("org_id", rest.org_id).eq("sku", sku).maybeSingle();
    if (!clash) break;
    sku = `${rest.sku}-COPY${i}`;
  }

  const { data: copy, error: insertError } = await supabase
    .from("products")
    .insert({
      ...rest,
      sku,
      name: `${rest.name} (copy)`,
      qty_on_hand: 0,
      qty_reserved: 0,
      qty_damaged: 0,
      qty_returned: 0,
    })
    .select("id")
    .single();
  if (insertError) throw insertError;

  revalidatePath("/products");
  return copy.id as string;
}
