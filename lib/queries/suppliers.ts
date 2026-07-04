import "server-only";
import { createClient } from "@/lib/supabase/server";

export interface SupplierRow {
  id: string;
  name: string;
  company: string | null;
  contactPerson: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  productCount: number;
}

export async function getSuppliersDetailed(): Promise<SupplierRow[]> {
  const supabase = await createClient();
  const [{ data: suppliers, error: supError }, { data: products, error: prodError }] = await Promise.all([
    supabase.from("suppliers").select("id, name, company, contact_person, email, phone, address").order("name"),
    supabase.from("products").select("supplier_id").is("archived_at", null),
  ]);
  if (supError) {
    console.error("[Inventra] getSuppliersDetailed (suppliers) failed:", supError);
    throw new Error("Could not load suppliers.");
  }
  if (prodError) {
    console.error("[Inventra] getSuppliersDetailed (products) failed:", prodError);
    throw new Error("Could not load suppliers.");
  }

  const counts = new Map<string, number>();
  for (const p of products ?? []) {
    if (!p.supplier_id) continue;
    counts.set(p.supplier_id, (counts.get(p.supplier_id) ?? 0) + 1);
  }

  return (suppliers ?? []).map((s) => ({
    id: s.id,
    name: s.name,
    company: s.company,
    contactPerson: s.contact_person,
    email: s.email,
    phone: s.phone,
    address: s.address,
    productCount: counts.get(s.id) ?? 0,
  }));
}

export interface SupplierPurchase {
  id: string;
  productName: string;
  qty: number;
  amount: number;
  createdAt: string;
}

export interface SupplierDetail extends SupplierRow {
  products: { id: string; name: string; sku: string; emoji: string | null }[];
  purchases: SupplierPurchase[];
  totalPurchases: number;
}

export async function getSupplierDetail(id: string): Promise<SupplierDetail | null> {
  const supabase = await createClient();
  const { data: supplier, error: supError } = await supabase
    .from("suppliers")
    .select("id, name, company, contact_person, email, phone, address")
    .eq("id", id)
    .single();
  if (supError || !supplier) return null;

  const { data: products, error: prodError } = await supabase
    .from("products")
    .select("id, name, sku, emoji, cost_price")
    .eq("supplier_id", id)
    .is("archived_at", null);
  if (prodError) {
    console.error("[Inventra] getSupplierDetail (products) failed:", prodError);
    throw new Error("Could not load this supplier's products.");
  }

  const productIds = (products ?? []).map((p) => p.id);
  const costById = new Map((products ?? []).map((p) => [p.id, Number(p.cost_price)]));

  let purchases: SupplierPurchase[] = [];
  let totalPurchases = 0;
  if (productIds.length > 0) {
    const { data: movements, error: movError } = await supabase
      .from("stock_movements")
      .select("id, product_id, qty_delta, unit_price, created_at, products(name)")
      .eq("type", "received")
      .in("product_id", productIds)
      .order("created_at", { ascending: false })
      .limit(25);
    if (movError) {
      console.error("[Inventra] getSupplierDetail (stock_movements) failed:", movError);
      throw new Error("Could not load this supplier's purchase history.");
    }
    purchases = (movements ?? []).map((m) => {
      const unitPrice = m.unit_price !== null ? Number(m.unit_price) : (costById.get(m.product_id) ?? 0);
      return {
        id: m.id,
        productName: (m.products as unknown as { name: string } | null)?.name ?? "—",
        qty: m.qty_delta,
        amount: m.qty_delta * unitPrice,
        createdAt: m.created_at,
      };
    });
    totalPurchases = purchases.reduce((sum, p) => sum + p.amount, 0);
  }

  return {
    id: supplier.id,
    name: supplier.name,
    company: supplier.company,
    contactPerson: supplier.contact_person,
    email: supplier.email,
    phone: supplier.phone,
    address: supplier.address,
    productCount: products?.length ?? 0,
    products: (products ?? []).map((p) => ({ id: p.id, name: p.name, sku: p.sku, emoji: p.emoji })),
    purchases,
    totalPurchases,
  };
}
