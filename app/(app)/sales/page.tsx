import { Suspense } from "react";
import { getSalesList } from "@/lib/queries/sales";
import { requireSalesProfile } from "@/lib/queries/session";
import { SalesClient } from "@/components/sales/SalesClient";

export default async function SalesPage() {
  await requireSalesProfile();
  const sales = await getSalesList();

  return (
    <Suspense>
      <SalesClient sales={sales} />
    </Suspense>
  );
}
