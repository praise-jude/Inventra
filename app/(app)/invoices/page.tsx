import { getInvoicesOverview, getInvoiceProductOptions } from "@/lib/queries/invoices";
import { requireSalesProfile } from "@/lib/queries/session";
import { InvoicesClient } from "@/components/invoices/InvoicesClient";
import type { CustomerInvoiceStatus } from "@/lib/supabase/database.types";

const PAGE_SIZE = 20;

export default async function InvoicesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  const page = Math.max(1, Number(params.page) || 1);
  const [overview, products, { profile, org }] = await Promise.all([
    getInvoicesOverview(
      { search: params.q, status: params.status as CustomerInvoiceStatus | undefined },
      page,
      PAGE_SIZE,
    ),
    getInvoiceProductOptions(),
    requireSalesProfile(),
  ]);
  const canManage = ["owner", "admin", "manager"].includes(profile.role);

  return (
    <InvoicesClient
      overview={overview}
      products={products}
      orgName={org.name}
      canManage={canManage}
      page={page}
      pageSize={PAGE_SIZE}
      filters={{ q: params.q ?? "", status: params.status ?? "" }}
    />
  );
}
