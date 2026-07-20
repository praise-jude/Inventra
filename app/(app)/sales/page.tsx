import { Suspense } from "react";
import { getSalesPage, type SalesPageFilters } from "@/lib/queries/sales";
import { getWarehouseOptions } from "@/lib/queries/products";
import { requireSalesProfile } from "@/lib/queries/session";
import { SalesClient } from "@/components/sales/SalesClient";

const PAGE_SIZE = 20;

export default async function SalesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  const page = Math.max(1, Number(params.page) || 1);
  const { profile } = await requireSalesProfile();
  const [{ rows, total }, warehouses] = await Promise.all([
    getSalesPage(
      {
        search: params.q,
        warehouseId: params.warehouse,
        dateFrom: params.dateFrom,
        dateTo: params.dateTo,
        paymentMethod: params.payment as SalesPageFilters["paymentMethod"],
      },
      page,
      PAGE_SIZE,
    ),
    getWarehouseOptions(),
  ]);
  const canDelete = ["owner", "admin", "manager"].includes(profile.role);

  return (
    <Suspense>
      <SalesClient
        rows={rows}
        total={total}
        page={page}
        pageSize={PAGE_SIZE}
        warehouses={warehouses}
        canDelete={canDelete}
        filters={{
          q: params.q ?? "",
          warehouse: params.warehouse ?? "",
          dateFrom: params.dateFrom ?? "",
          dateTo: params.dateTo ?? "",
          payment: params.payment ?? "",
        }}
      />
    </Suspense>
  );
}
