import "server-only";
import { createClient } from "@/lib/supabase/server";
import { getSupplierSupplyStats, type SupplierSupplyStats } from "@/lib/queries/supply-records";

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

interface SupplierProductCountRow {
  supplier_id: string;
  count: number;
}

export interface SuppliersFilters {
  search?: string;
}

// Server-side paginated + filtered, same shape as this session's Team/
// Debtors/Invoices/Supply Records pagination work — the old getSuppliersDetailed
// (unbounded, loaded every supplier) doesn't scale for orgs with a large
// supplier directory. get_supplier_product_counts() stays a single
// unpaginated call: it's already a GROUP BY aggregate bounded by distinct
// suppliers-with-products, not a per-row scan, so it's cheap regardless of
// how many suppliers exist — only the raw `suppliers` row fetch needed
// pagination.
export async function getSuppliersPage(
  filters: SuppliersFilters,
  page = 1,
  pageSize = 20,
): Promise<{ rows: SupplierRow[]; total: number }> {
  const supabase = await createClient();
  let query = supabase
    .from("suppliers")
    .select("id, name, company, contact_person, email, phone, address", { count: "exact" })
    .order("name");
  if (filters.search?.trim()) {
    const q = filters.search.trim().replace(/[%,]/g, "");
    query = query.or(`name.ilike.%${q}%,company.ilike.%${q}%`);
  }

  const from = (page - 1) * pageSize;
  const [{ data: suppliers, error: supError, count }, { data: counts, error: prodError }] = await Promise.all([
    query.range(from, from + pageSize - 1),
    supabase.rpc("get_supplier_product_counts"),
  ]);
  if (supError) {
    console.error("[Inventra] getSuppliersPage (suppliers) failed:", supError);
    throw new Error("Could not load suppliers.");
  }
  if (prodError) {
    console.error("[Inventra] getSuppliersPage (product counts) failed:", prodError);
    throw new Error("Could not load suppliers.");
  }

  const countsBySupplier = new Map(
    ((counts ?? []) as SupplierProductCountRow[]).map((c) => [c.supplier_id, c.count]),
  );

  const rows = (suppliers ?? []).map((s) => ({
    id: s.id,
    name: s.name,
    company: s.company,
    contactPerson: s.contact_person,
    email: s.email,
    phone: s.phone,
    address: s.address,
    productCount: countsBySupplier.get(s.id) ?? 0,
  }));
  return { rows, total: count ?? 0 };
}

export interface SupplierOption {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
}

// Bounded picker list for the Supply Records "new" form's supplier
// dropdown — doesn't need pagination or product counts, just enough rows
// to populate a <select>. Mirrors getWarehouseOptions()/
// getActiveTeamMembersForPresence()'s "lightweight bounded query for a
// narrow consumer" pattern.
export async function getSupplierOptions(): Promise<SupplierOption[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("suppliers").select("id, name, phone, email").order("name").limit(500);
  if (error) {
    console.error("[Inventra] getSupplierOptions failed:", error);
    return [];
  }
  return data ?? [];
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
  // Real, directly-attributed stats from supply_records — see
  // getSupplierSupplyStats. The `purchases`/`totalPurchases` fields above
  // are kept as-is (a derived stock_movements join, predates Supply
  // Records) since not every product's stock history necessarily has a
  // supply record behind it.
  supplyStats: SupplierSupplyStats;
}

export async function getSupplierDetail(id: string): Promise<SupplierDetail | null> {
  const supabase = await createClient();
  const { data: supplier, error: supError } = await supabase
    .from("suppliers")
    .select("id, name, company, contact_person, email, phone, address")
    .eq("id", id)
    .single();
  if (supError || !supplier) return null;

  const supplyStats = await getSupplierSupplyStats(id);

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
    supplyStats,
  };
}
