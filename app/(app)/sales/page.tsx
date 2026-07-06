import { Suspense } from "react";
import { getSalesList } from "@/lib/queries/sales";
import { getCustomerOptions } from "@/lib/queries/customers";
import { requireSalesProfile } from "@/lib/queries/session";
import { SalesClient } from "@/components/sales/SalesClient";

export default async function SalesPage() {
  const { profile } = await requireSalesProfile();
  const [sales, customers] = await Promise.all([getSalesList(), getCustomerOptions()]);
  const canDelete = ["owner", "admin", "manager"].includes(profile.role);

  return (
    <Suspense>
      <SalesClient sales={sales} customers={customers} canDelete={canDelete} />
    </Suspense>
  );
}
