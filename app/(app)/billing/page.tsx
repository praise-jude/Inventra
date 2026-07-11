import { getBillingData } from "@/lib/queries/billing";
import { requireAdminProfile } from "@/lib/queries/session";
import { BillingClient } from "@/components/billing/BillingClient";

export default async function BillingPage() {
  await requireAdminProfile();
  const { org, subscription, invoices } = await getBillingData();

  return <BillingClient orgName={org.name} subscription={subscription} invoices={invoices} />;
}
