import { getBillingData } from "@/lib/queries/billing";
import { requireAdminProfile } from "@/lib/queries/session";
import { getEntitlements } from "@/lib/entitlements";
import { BillingClient } from "@/components/billing/BillingClient";
import { UsageDashboard } from "@/components/billing/UsageDashboard";

export default async function BillingPage() {
  await requireAdminProfile();
  const [{ org, subscription, invoices }, entitlements] = await Promise.all([getBillingData(), getEntitlements()]);

  return (
    <>
      <UsageDashboard entitlements={entitlements} />
      <BillingClient orgName={org.name} subscription={subscription} invoices={invoices} />
    </>
  );
}
