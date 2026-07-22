import { requireManagerProfile } from "@/lib/queries/session";
import { listPendingApprovals } from "@/lib/actions/approvals";
import { ApprovalsClient } from "@/components/approvals/ApprovalsClient";

export default async function ApprovalsPage() {
  await requireManagerProfile();
  const requests = await listPendingApprovals();

  return (
    <div className="mx-auto max-w-[880px] px-6 py-8">
      <h1 className="mb-1 text-2xl font-bold tracking-tight">Approvals</h1>
      <p className="mb-6 text-[13.5px] text-text-2">Discounts, voids, and price changes waiting on your sign-off.</p>
      <ApprovalsClient initialRequests={requests} />
    </div>
  );
}
