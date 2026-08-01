import "server-only";
import { createClient } from "@/lib/supabase/server";

export interface SupplyRecordRow {
  id: string;
  referenceNumber: string;
  supplierName: string;
  invoiceNumber: string | null;
  warehouseName: string | null;
  dateSupplied: string;
  status: string;
  totalQuantity: number;
  totalAmount: number;
  createdByName: string | null;
}

export interface SupplyRecordsFilters {
  search?: string;
  supplierId?: string;
  productId?: string;
  warehouseId?: string;
  status?: string;
  dateFrom?: string;
  dateTo?: string;
}

// Server-side paginated + filtered, mirrors this session's Debtors/Invoices
// pagination work (lib/queries/debtors.ts) exactly — a lightweight
// aggregate query for the summary cards runs separately from the paginated
// rows, so totals always reflect the FULL filtered dataset, not just the
// current page.
export async function getSupplyRecords(
  filters: SupplyRecordsFilters,
  page = 1,
  pageSize = 20,
): Promise<{ rows: SupplyRecordRow[]; total: number }> {
  const supabase = await createClient();

  let productSupplyIds: string[] | null = null;
  if (filters.productId) {
    const { data } = await supabase.from("supply_record_items").select("supply_record_id").eq("product_id", filters.productId);
    productSupplyIds = Array.from(new Set((data ?? []).map((r) => r.supply_record_id)));
    if (productSupplyIds.length === 0) return { rows: [], total: 0 };
  }

  let query = supabase
    .from("supply_records")
    .select(
      "id, reference_number, supplier_name, invoice_number, date_supplied, status, total_quantity, total_amount, warehouses(name), profiles!supply_records_created_by_fkey(first_name, last_name)",
      { count: "exact" },
    )
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  if (filters.supplierId) query = query.eq("supplier_id", filters.supplierId);
  if (filters.warehouseId) query = query.eq("warehouse_id", filters.warehouseId);
  if (filters.status) query = query.eq("status", filters.status);
  if (filters.dateFrom) query = query.gte("date_supplied", filters.dateFrom);
  if (filters.dateTo) query = query.lte("date_supplied", filters.dateTo);
  if (productSupplyIds) query = query.in("id", productSupplyIds);
  if (filters.search) {
    const q = filters.search.replace(/[%,]/g, "");
    query = query.or(`supplier_name.ilike.%${q}%,invoice_number.ilike.%${q}%,reference_number.ilike.%${q}%`);
  }

  const from = (page - 1) * pageSize;
  const { data, error, count } = await query.range(from, from + pageSize - 1);
  if (error) {
    console.error("[Inventra] getSupplyRecords failed:", error);
    throw new Error("Could not load supply records.");
  }

  const rows: SupplyRecordRow[] = (data ?? []).map((r) => ({
    id: r.id,
    referenceNumber: r.reference_number,
    supplierName: r.supplier_name,
    invoiceNumber: r.invoice_number,
    warehouseName: (r.warehouses as unknown as { name: string } | null)?.name ?? null,
    dateSupplied: r.date_supplied,
    status: r.status,
    totalQuantity: Number(r.total_quantity),
    totalAmount: Number(r.total_amount),
    createdByName: r.profiles ? `${(r.profiles as unknown as { first_name: string; last_name: string }).first_name} ${(r.profiles as unknown as { first_name: string; last_name: string }).last_name}` : null,
  }));

  return { rows, total: count ?? 0 };
}

export interface SupplyRecordItemDetail {
  id: string;
  productId: string;
  productName: string;
  quantity: number;
  unitCost: number;
  lineTotal: number;
}

export interface SupplyRecordDetail {
  id: string;
  referenceNumber: string;
  supplierId: string | null;
  supplierName: string;
  supplierPhone: string | null;
  supplierEmail: string | null;
  invoiceNumber: string | null;
  warehouseId: string;
  warehouseName: string | null;
  dateSupplied: string;
  status: string;
  totalQuantity: number;
  totalAmount: number;
  notes: string | null;
  createdByName: string | null;
  verifiedByName: string | null;
  verifiedAt: string | null;
  cancelledByName: string | null;
  cancelledAt: string | null;
  createdAt: string;
  items: SupplyRecordItemDetail[];
}

export async function getSupplyRecordDetail(id: string): Promise<SupplyRecordDetail | null> {
  const supabase = await createClient();
  const { data: record, error } = await supabase
    .from("supply_records")
    .select(
      `id, reference_number, supplier_id, supplier_name, supplier_phone, supplier_email, invoice_number,
       warehouse_id, date_supplied, status, total_quantity, total_amount, notes, created_at,
       verified_at, cancelled_at,
       warehouses(name),
       created_by_profile:profiles!supply_records_created_by_fkey(first_name, last_name),
       verified_by_profile:profiles!supply_records_verified_by_fkey(first_name, last_name),
       cancelled_by_profile:profiles!supply_records_cancelled_by_fkey(first_name, last_name)`,
    )
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();
  if (error || !record) return null;

  const { data: items } = await supabase
    .from("supply_record_items")
    .select("id, product_id, quantity, unit_cost, line_total, products(name)")
    .eq("supply_record_id", id);

  type ProfileRef = { first_name: string; last_name: string } | null;
  const createdBy = record.created_by_profile as unknown as ProfileRef;
  const verifiedBy = record.verified_by_profile as unknown as ProfileRef;
  const cancelledBy = record.cancelled_by_profile as unknown as ProfileRef;

  return {
    id: record.id,
    referenceNumber: record.reference_number,
    supplierId: record.supplier_id,
    supplierName: record.supplier_name,
    supplierPhone: record.supplier_phone,
    supplierEmail: record.supplier_email,
    invoiceNumber: record.invoice_number,
    warehouseId: record.warehouse_id,
    warehouseName: (record.warehouses as unknown as { name: string } | null)?.name ?? null,
    dateSupplied: record.date_supplied,
    status: record.status,
    totalQuantity: Number(record.total_quantity),
    totalAmount: Number(record.total_amount),
    notes: record.notes,
    createdByName: createdBy ? `${createdBy.first_name} ${createdBy.last_name}` : null,
    verifiedByName: verifiedBy ? `${verifiedBy.first_name} ${verifiedBy.last_name}` : null,
    verifiedAt: record.verified_at,
    cancelledByName: cancelledBy ? `${cancelledBy.first_name} ${cancelledBy.last_name}` : null,
    cancelledAt: record.cancelled_at,
    createdAt: record.created_at,
    items: (items ?? []).map((i) => ({
      id: i.id,
      productId: i.product_id,
      productName: (i.products as unknown as { name: string } | null)?.name ?? "—",
      quantity: Number(i.quantity),
      unitCost: Number(i.unit_cost),
      lineTotal: Number(i.line_total),
    })),
  };
}

export interface SupplySummary {
  totalSupplies: number;
  totalAmount: number;
  todaysSupplies: number;
  thisWeekSupplies: number;
  thisMonthSupplies: number;
  totalQuantityReceived: number;
  topSupplier: { name: string; totalAmount: number } | null;
  mostSuppliedProduct: { name: string; totalQuantity: number } | null;
}

// Lightweight aggregate scan (a handful of columns, not the full paginated
// row shape) so the summary cards always reflect the whole dataset, same
// split as getDebtorsOverview/getInvoicesOverview elsewhere this session.
export async function getSupplySummary(): Promise<SupplySummary> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("supply_records")
    .select("id, supplier_name, total_amount, total_quantity, date_supplied, created_at")
    .is("deleted_at", null)
    .neq("status", "cancelled");
  if (error || !data) {
    console.error("[Inventra] getSupplySummary failed:", error);
    return { totalSupplies: 0, totalAmount: 0, todaysSupplies: 0, thisWeekSupplies: 0, thisMonthSupplies: 0, totalQuantityReceived: 0, topSupplier: null, mostSuppliedProduct: null };
  }

  const now = new Date();
  const todayKey = now.toISOString().slice(0, 10);
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  let totalAmount = 0;
  let totalQuantityReceived = 0;
  let todaysSupplies = 0;
  let thisWeekSupplies = 0;
  let thisMonthSupplies = 0;
  const bySupplier = new Map<string, number>();

  for (const r of data) {
    totalAmount += Number(r.total_amount);
    totalQuantityReceived += Number(r.total_quantity);
    bySupplier.set(r.supplier_name, (bySupplier.get(r.supplier_name) ?? 0) + Number(r.total_amount));
    if (r.date_supplied === todayKey) todaysSupplies++;
    const created = new Date(r.created_at);
    if (created >= weekAgo) thisWeekSupplies++;
    if (created >= monthAgo) thisMonthSupplies++;
  }

  let topSupplier: SupplySummary["topSupplier"] = null;
  for (const [name, amount] of bySupplier) {
    if (!topSupplier || amount > topSupplier.totalAmount) topSupplier = { name, totalAmount: amount };
  }

  // supply_records_ids from the same non-cancelled/non-deleted scan above —
  // filtering supply_record_items directly by that id list rather than
  // trying to filter an embedded join's columns (unreliable in Supabase JS).
  const validSupplyIds = data.map((r) => r.id);
  const { data: productTotals } = validSupplyIds.length
    ? await supabase.from("supply_record_items").select("quantity, products(name), supply_record_id").in("supply_record_id", validSupplyIds)
    : { data: [] as { quantity: number; products: unknown }[] };
  const byProduct = new Map<string, number>();
  for (const row of productTotals ?? []) {
    const name = (row.products as unknown as { name: string } | null)?.name ?? "—";
    byProduct.set(name, (byProduct.get(name) ?? 0) + Number(row.quantity));
  }
  let mostSuppliedProduct: SupplySummary["mostSuppliedProduct"] = null;
  for (const [name, qty] of byProduct) {
    if (!mostSuppliedProduct || qty > mostSuppliedProduct.totalQuantity) mostSuppliedProduct = { name, totalQuantity: qty };
  }

  return {
    totalSupplies: data.length,
    totalAmount,
    todaysSupplies,
    thisWeekSupplies,
    thisMonthSupplies,
    totalQuantityReceived,
    topSupplier,
    mostSuppliedProduct,
  };
}

export interface SupplyCostTrendPoint {
  month: string;
  totalAmount: number;
}

// Monthly totals, last 12 months — the one chart kept from the spec's full
// analytics matrix (see plan's "Explicitly out of scope").
export async function getSupplyCostTrend(): Promise<SupplyCostTrendPoint[]> {
  const supabase = await createClient();
  const twelveMonthsAgo = new Date();
  twelveMonthsAgo.setUTCMonth(twelveMonthsAgo.getUTCMonth() - 11);
  twelveMonthsAgo.setUTCDate(1);

  const { data, error } = await supabase
    .from("supply_records")
    .select("date_supplied, total_amount")
    .is("deleted_at", null)
    .neq("status", "cancelled")
    .gte("date_supplied", twelveMonthsAgo.toISOString().slice(0, 10));
  if (error || !data) return [];

  const totals = new Map<string, number>();
  for (const r of data) {
    const key = r.date_supplied.slice(0, 7);
    totals.set(key, (totals.get(key) ?? 0) + Number(r.total_amount));
  }
  return Array.from(totals.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, totalAmount]) => ({ month, totalAmount }));
}

export interface SupplierSupplyStats {
  totalSupplies: number;
  totalAmount: number;
  lastSupplyDate: string | null;
  averageSupplyValue: number;
}

// Feeds the extended SupplierDetailSlideOver — replaces the derived
// stock_movements-join "purchase history" with real, directly-attributed
// supply-record stats now that a real transactional link exists.
export async function getSupplierSupplyStats(supplierId: string): Promise<SupplierSupplyStats> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("supply_records")
    .select("total_amount, date_supplied")
    .eq("supplier_id", supplierId)
    .is("deleted_at", null)
    .neq("status", "cancelled")
    .order("date_supplied", { ascending: false });
  if (error || !data || data.length === 0) {
    return { totalSupplies: 0, totalAmount: 0, lastSupplyDate: null, averageSupplyValue: 0 };
  }
  const totalAmount = data.reduce((sum, r) => sum + Number(r.total_amount), 0);
  return {
    totalSupplies: data.length,
    totalAmount,
    lastSupplyDate: data[0].date_supplied,
    averageSupplyValue: totalAmount / data.length,
  };
}
