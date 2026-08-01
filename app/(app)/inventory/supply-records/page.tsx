import { getSupplyRecords, getSupplySummary, getSupplyCostTrend, type SupplyRecordsFilters } from "@/lib/queries/supply-records";
import { getWarehouseOptions } from "@/lib/queries/products";
import { requireProfile } from "@/lib/queries/session";
import { requirePermission } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";
import { SupplyRecordsClient } from "@/components/supply-records/SupplyRecordsClient";

const PAGE_SIZE = 20;

export default async function SupplyRecordsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; warehouse?: string; page?: string }>;
}) {
  const { profile } = await requireProfile();
  const supabase = await createClient();
  await requirePermission(supabase, "supply_records", "view");

  const params = await searchParams;
  const page = Math.max(1, Number(params.page) || 1);
  const filters: SupplyRecordsFilters = {
    search: params.q || undefined,
    status: params.status || undefined,
    warehouseId: params.warehouse || undefined,
  };

  const [{ rows, total }, summary, costTrend, warehouses] = await Promise.all([
    getSupplyRecords(filters, page, PAGE_SIZE),
    getSupplySummary(),
    getSupplyCostTrend(),
    getWarehouseOptions(),
  ]);

  return (
    <SupplyRecordsClient
      rows={rows}
      total={total}
      page={page}
      pageSize={PAGE_SIZE}
      summary={summary}
      costTrend={costTrend}
      warehouses={warehouses}
      isManager={["owner", "admin", "manager"].includes(profile.role)}
      filters={{ q: params.q ?? "", status: params.status ?? "", warehouse: params.warehouse ?? "" }}
    />
  );
}
