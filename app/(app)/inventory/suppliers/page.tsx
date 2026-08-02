import { getSuppliersPage } from "@/lib/queries/suppliers";
import { requireProfile } from "@/lib/queries/session";
import { SuppliersClient } from "@/components/suppliers/SuppliersClient";

const PAGE_SIZE = 20;

export default async function SuppliersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  const params = await searchParams;
  const page = Math.max(1, Number(params.page) || 1);
  const filters = { search: params.q };

  const [{ rows, total }, { profile }] = await Promise.all([
    getSuppliersPage(filters, page, PAGE_SIZE),
    requireProfile(),
  ]);
  const canManage = ["owner", "admin", "manager"].includes(profile.role);

  return (
    <SuppliersClient
      rows={rows}
      total={total}
      page={page}
      pageSize={PAGE_SIZE}
      canManage={canManage}
      filters={{ q: params.q ?? "" }}
    />
  );
}
