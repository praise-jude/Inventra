import Image from "next/image";
import { requireProfile } from "@/lib/queries/session";
import { getBillingData } from "@/lib/queries/billing";
import { BillingClient } from "@/components/billing/BillingClient";

const HEADLINES: Record<string, string> = {
  expired: "Your free trial has ended",
  cancelled: "Your subscription was cancelled",
  past_due: "There's a problem with your payment",
  payment_failed: "Your last payment failed",
  suspended: "Your account is suspended",
};

export default async function SubscriptionRequiredPage() {
  const { profile } = await requireProfile();
  const canManageBilling = profile.role === "owner" || profile.role === "admin";
  const { org, subscription, invoices } = await getBillingData();
  const headline = HEADLINES[subscription.status] ?? "Your subscription needs attention";

  return (
    <div className="min-h-screen bg-hover px-4 py-10">
      <div className="mx-auto max-w-[720px] animate-fade-up">
        <div className="mb-8 flex flex-col items-center text-center">
          <Image src="/inventra-logo.svg" alt="Inventra" width={56} height={56} />
          <h1 className="mt-4 text-[24px] font-bold tracking-tight">{headline}</h1>
          <p className="mt-1.5 max-w-[440px] text-[13.5px] text-text-2">
            {canManageBilling
              ? "Renew your subscription below to restore full access to Inventra."
              : "Access is restricted until an owner or admin renews the subscription."}
          </p>
        </div>

        {canManageBilling ? (
          <BillingClient orgName={org.name} subscription={subscription} invoices={invoices} />
        ) : (
          <div className="rounded-2xl border border-border bg-surface p-6 text-center shadow-[var(--shadow-sm)]">
            <p className="text-[13px] text-text-2">
              Please contact your workspace owner or admin to renew the subscription and restore access.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
