"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  getProductDetail,
  findProductIdByCode,
  getProductsForExport,
  type ProductDetail,
  type ProductExportRow,
} from "@/lib/queries/products";

async function requireOrgId() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  const { data: profile } = await supabase.from("profiles").select("org_id, role").eq("id", user.id).single();
  if (!profile) throw new Error("No profile");
  return { supabase, orgId: profile.org_id as string, userId: user.id, role: profile.role as string };
}

export async function fetchProductDetail(id: string): Promise<ProductDetail | null> {
  return getProductDetail(id);
}

export async function lookupProductByCode(code: string): Promise<ProductDetail | null> {
  const id = await findProductIdByCode(code);
  if (!id) return null;
  return getProductDetail(id);
}

export async function exportProductsCsv(): Promise<ProductExportRow[]> {
  return getProductsForExport();
}

export interface CreateProductInput {
  name: string;
  description?: string;
  sku: string;
  barcode?: string;
  categoryId?: string;
  unit: string;
  costPrice: number;
  sellPrice: number;
  reorderLevel: number;
  supplierId?: string;
  warehouseId?: string;
  openingQty: number;
  imageUrl?: string;
}

export async function createProduct(input: CreateProductInput) {
  const { supabase, orgId, userId } = await requireOrgId();

  const { data: product, error } = await supabase
    .from("products")
    .insert({
      org_id: orgId,
      name: input.name,
      description: input.description || null,
      sku: input.sku,
      barcode: input.barcode?.trim() || null,
      category_id: input.categoryId || null,
      unit: input.unit || "each",
      cost_price: input.costPrice,
      sell_price: input.sellPrice,
      reorder_level: input.reorderLevel,
      supplier_id: input.supplierId || null,
      warehouse_id: input.warehouseId || null,
      image_url: input.imageUrl || null,
      qty_on_hand: 0,
    })
    .select("id")
    .single();
  if (error) {
    if (error.code === "23505") throw new Error("A product with this SKU or barcode already exists.");
    console.error("[Inventra] createProduct failed:", error);
    throw new Error("Could not create the product.");
  }

  if (input.openingQty > 0) {
    await supabase.from("stock_movements").insert({
      org_id: orgId,
      product_id: product.id,
      warehouse_id: input.warehouseId || null,
      type: "received",
      qty_delta: input.openingQty,
      reason: "Opening stock",
      created_by: userId,
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
  barcode?: string;
  categoryId?: string;
  unit: string;
  brand?: string;
  costPrice: number;
  sellPrice: number;
  reorderLevel: number;
  supplierId?: string;
  warehouseId?: string;
  expiryDate?: string;
  imageUrl?: string;
}

export async function updateProduct(id: string, input: UpdateProductInput): Promise<ProductDetail> {
  const { supabase, orgId } = await requireOrgId();
  const name = input.name.trim();
  const sku = input.sku.trim();
  if (!name) throw new Error("Product name is required.");
  if (!sku) throw new Error("SKU is required.");

  const { data: clash } = await supabase
    .from("products")
    .select("id")
    .eq("org_id", orgId)
    .eq("sku", sku)
    .neq("id", id)
    .maybeSingle();
  if (clash) throw new Error("Another product already uses this SKU.");

  const { data: updated, error } = await supabase
    .from("products")
    .update({
      name,
      description: input.description?.trim() || null,
      sku,
      barcode: input.barcode?.trim() || null,
      category_id: input.categoryId || null,
      unit: input.unit || "each",
      brand: input.brand?.trim() || null,
      cost_price: input.costPrice,
      sell_price: input.sellPrice,
      reorder_level: input.reorderLevel,
      supplier_id: input.supplierId || null,
      warehouse_id: input.warehouseId || null,
      expiry_date: input.expiryDate || null,
      image_url: input.imageUrl || null,
    })
    .eq("id", id)
    .eq("org_id", orgId)
    .select("id")
    .maybeSingle();
  if (error) {
    if (error.code === "23505") throw new Error("A product with this SKU or barcode already exists.");
    console.error("[Inventra] updateProduct failed:", error);
    throw new Error("Could not update the product.");
  }
  // A Postgres UPDATE that matches zero rows (wrong id, or blocked by RLS)
  // returns no error at all — without this check the caller would show a
  // false "Product updated" success while nothing changed in the database.
  if (!updated) {
    throw new Error("Could not update the product — it may have been deleted or you no longer have access to it.");
  }

  revalidatePath("/products");
  revalidatePath("/dashboard");

  const fresh = await getProductDetail(id);
  if (!fresh) throw new Error("Product updated, but could not reload its details.");
  return fresh;
}

export async function archiveProduct(id: string) {
  const { supabase, orgId } = await requireOrgId();
  const { data: archived, error } = await supabase
    .from("products")
    .update({ archived_at: new Date().toISOString() })
    .eq("id", id)
    .eq("org_id", orgId)
    .select("id")
    .maybeSingle();
  if (error) throw error;
  if (!archived) throw new Error("Could not archive the product — it may have been deleted or you no longer have access to it.");
  revalidatePath("/products");
  revalidatePath("/dashboard");
}

export async function deleteProduct(id: string) {
  const { supabase, orgId, role } = await requireOrgId();
  if (!["owner", "admin", "manager"].includes(role)) {
    throw new Error("Only an owner, admin, or manager can delete a product.");
  }

  const { count } = await supabase
    .from("stock_movements")
    .select("id", { count: "exact", head: true })
    .eq("product_id", id);
  if ((count ?? 0) > 0) {
    throw new Error("This product has stock/sale history — use Archive instead to keep its records intact.");
  }

  const { data: deleted, error } = await supabase
    .from("products")
    .delete()
    .eq("id", id)
    .eq("org_id", orgId)
    .select("id")
    .maybeSingle();
  if (error) {
    console.error("[Inventra] deleteProduct failed:", error);
    throw new Error("Could not delete the product.");
  }
  if (!deleted) throw new Error("Could not delete the product — it may have already been removed.");
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
    barcode: _barcode,
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
  void _barcode;

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

export async function uploadProductImage(formData: FormData) {
  const { supabase, orgId } = await requireOrgId();

  const file = formData.get("file");
  if (!(file instanceof File)) throw new Error("No file provided.");
  if (!file.type.startsWith("image/")) throw new Error("Only image files are allowed.");
  if (file.size > 5 * 1024 * 1024) throw new Error("Image must be under 5MB.");

  const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
  const path = `${orgId}/${crypto.randomUUID()}.${ext}`;

  const { error } = await supabase.storage.from("product-images").upload(path, file, {
    contentType: file.type,
    upsert: false,
  });
  if (error) {
    console.error("[Inventra] uploadProductImage failed:", error);
    throw new Error("Could not upload the image.");
  }

  const { data } = supabase.storage.from("product-images").getPublicUrl(path);
  return data.publicUrl;
}

export interface ImportProductRow {
  name?: string;
  sku?: string;
  barcode?: string;
  description?: string;
  brand?: string;
  category?: string;
  supplier?: string;
  warehouse?: string;
  unit?: string;
  cost_price?: string;
  sell_price?: string;
  reorder_level?: string;
  qty_on_hand?: string;
  expiry_date?: string;
  image_url?: string;
}

export interface ImportResult {
  created: number;
  updated: number;
  failed: number;
  errors: { row: number; message: string }[];
}

export async function importProductsCsv(rows: ImportProductRow[]): Promise<ImportResult> {
  const { supabase, orgId, userId } = await requireOrgId();
  const result: ImportResult = { created: 0, updated: 0, failed: 0, errors: [] };

  const [{ data: categories }, { data: suppliers }, { data: warehouses }] = await Promise.all([
    supabase.from("categories").select("id, name").eq("org_id", orgId),
    supabase.from("suppliers").select("id, name").eq("org_id", orgId),
    supabase.from("warehouses").select("id, name").eq("org_id", orgId),
  ]);
  const categoryByName = new Map((categories ?? []).map((c) => [c.name.toLowerCase(), c.id]));
  const supplierByName = new Map((suppliers ?? []).map((s) => [s.name.toLowerCase(), s.id]));
  const warehouseByName = new Map((warehouses ?? []).map((w) => [w.name.toLowerCase(), w.id]));

  async function resolveCategoryId(name: string | undefined): Promise<string | null> {
    const trimmed = name?.trim();
    if (!trimmed) return null;
    const existing = categoryByName.get(trimmed.toLowerCase());
    if (existing) return existing;
    const { data, error } = await supabase.from("categories").insert({ org_id: orgId, name: trimmed }).select("id").single();
    if (error || !data) return null;
    categoryByName.set(trimmed.toLowerCase(), data.id);
    return data.id;
  }

  async function resolveSupplierId(name: string | undefined): Promise<string | null> {
    const trimmed = name?.trim();
    if (!trimmed) return null;
    const existing = supplierByName.get(trimmed.toLowerCase());
    if (existing) return existing;
    const { data, error } = await supabase.from("suppliers").insert({ org_id: orgId, name: trimmed }).select("id").single();
    if (error || !data) return null;
    supplierByName.set(trimmed.toLowerCase(), data.id);
    return data.id;
  }

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowNum = i + 2; // header is row 1
    try {
      const name = row.name?.trim();
      const sku = row.sku?.trim();
      if (!name) throw new Error("Missing product name.");
      if (!sku) throw new Error("Missing SKU.");

      const costPrice = row.cost_price ? Number(row.cost_price) : 0;
      const sellPrice = row.sell_price ? Number(row.sell_price) : 0;
      const reorderLevel = row.reorder_level ? Number(row.reorder_level) : 0;
      if ([costPrice, sellPrice, reorderLevel].some((n) => Number.isNaN(n))) {
        throw new Error("Cost price, sell price, and reorder level must be numbers.");
      }

      const categoryId = await resolveCategoryId(row.category);
      const supplierId = await resolveSupplierId(row.supplier);
      const warehouseId = row.warehouse?.trim() ? warehouseByName.get(row.warehouse.trim().toLowerCase()) ?? null : null;

      const { data: existing } = await supabase.from("products").select("id").eq("org_id", orgId).eq("sku", sku).maybeSingle();

      if (existing) {
        const { error } = await supabase
          .from("products")
          .update({
            name,
            description: row.description?.trim() || null,
            barcode: row.barcode?.trim() || null,
            brand: row.brand?.trim() || null,
            category_id: categoryId,
            supplier_id: supplierId,
            warehouse_id: warehouseId,
            unit: row.unit?.trim() || "each",
            cost_price: costPrice,
            sell_price: sellPrice,
            reorder_level: reorderLevel,
            image_url: row.image_url?.trim() || null,
          })
          .eq("id", existing.id);
        if (error) throw new Error(error.message);
        result.updated++;
      } else {
        const qtyOnHand = row.qty_on_hand ? Number(row.qty_on_hand) : 0;
        const { data: created, error } = await supabase
          .from("products")
          .insert({
            org_id: orgId,
            name,
            sku,
            description: row.description?.trim() || null,
            barcode: row.barcode?.trim() || null,
            brand: row.brand?.trim() || null,
            category_id: categoryId,
            supplier_id: supplierId,
            warehouse_id: warehouseId,
            unit: row.unit?.trim() || "each",
            cost_price: costPrice,
            sell_price: sellPrice,
            reorder_level: reorderLevel,
            expiry_date: row.expiry_date?.trim() || null,
            image_url: row.image_url?.trim() || null,
            qty_on_hand: 0,
          })
          .select("id")
          .single();
        if (error || !created) throw new Error(error?.message ?? "Insert failed.");

        if (qtyOnHand > 0) {
          await supabase.from("stock_movements").insert({
            org_id: orgId,
            product_id: created.id,
            warehouse_id: warehouseId,
            type: "received",
            qty_delta: qtyOnHand,
            reason: "CSV import — opening stock",
            created_by: userId,
          });
        }
        result.created++;
      }
    } catch (err) {
      result.failed++;
      result.errors.push({ row: rowNum, message: err instanceof Error ? err.message : "Unknown error." });
    }
  }

  revalidatePath("/products");
  revalidatePath("/dashboard");
  return result;
}
