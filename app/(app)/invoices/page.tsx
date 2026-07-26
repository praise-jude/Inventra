import { getInvoicesOverview, getInvoiceProductOptions } from "@/lib/queries/invoices";
import { requireSalesProfile } from "@/lib/queries/session";
import { InvoicesClient } from "@/components/invoices/InvoicesClient";

export default async function InvoicesPage() {
  const [overview, products, { profile, org }] = await Promise.all([
    getInvoicesOverview(),
    getInvoiceProductOptions(),
    requireSalesProfile(),
  ]);
  const canManage = ["owner", "admin", "manager"].includes(profile.role);

  return <InvoicesClient overview={overview} products={products} orgName={org.name} canManage={canManage} />;
}
