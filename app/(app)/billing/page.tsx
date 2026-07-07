import { getBillingData } from "@/lib/queries/billing";
import { requireAdminProfile } from "@/lib/queries/session";
import { BillingClient } from "@/components/billing/BillingClient";

export default async function BillingPage() {
  await requireAdminProfile();
  const { org, seatsUsed, skuCount, warehouseCount, invoices } = await getBillingData();

  return (
    <BillingClient
      planKey={org.plan}
      seatsUsed={seatsUsed}
      skuCount={skuCount}
      warehouseCount={warehouseCount}
      renewsAt={org.trial_ends_at}
      invoices={invoices}
    />
  );
}
