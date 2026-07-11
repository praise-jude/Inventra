import { verifyTransaction } from "@/lib/paystack";
import { CallbackRedirect } from "@/components/onboarding/CallbackRedirect";

export default async function OnboardingPlanCallbackPage({
  searchParams,
}: {
  searchParams: Promise<{ reference?: string; trxref?: string }>;
}) {
  const params = await searchParams;
  const reference = params.reference ?? params.trxref;

  let ok = false;
  let message = "We couldn't confirm your payment method. Please try again.";
  if (reference) {
    try {
      const result = await verifyTransaction(reference);
      ok = result.status === "success";
      if (!ok) message = "Card verification didn't complete. Please try adding your card again.";
    } catch {
      // Fall through with the generic failure message — the webhook, once
      // delivered, remains the real source of truth regardless of whether
      // this read-only verification call succeeded.
    }
  }

  return (
    <div className="max-w-[480px] animate-fade-up text-center">
      <div className="rounded-2xl border border-border bg-surface p-8 shadow-[var(--shadow-sm)]">
        <div className="mb-3 text-[32px]">{ok ? "✅" : "⚠️"}</div>
        <div className="mb-1.5 text-[17px] font-bold">{ok ? "Card verified" : "Something went wrong"}</div>
        <p className="text-[13px] text-text-2">
          {ok ? "Setting up your account — you'll be redirected in a moment…" : message}
        </p>
      </div>
      {ok && <CallbackRedirect to="/dashboard" />}
    </div>
  );
}
