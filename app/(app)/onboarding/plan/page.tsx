import { requireProfile } from "@/lib/queries/session";
import { OnboardingPlanFlow } from "@/components/onboarding/OnboardingPlanFlow";

export default async function OnboardingPlanPage() {
  const { profile } = await requireProfile();
  const canManageBilling = profile.role === "owner" || profile.role === "admin";

  return (
    <div className="max-w-[560px] animate-fade-up">
      <div className="mb-[18px]">
        <div className="text-[22px] font-bold tracking-tight">Choose your plan</div>
        <div className="mt-[3px] text-text-2">
          {canManageBilling
            ? "Pick a plan and add a payment method to start your 6-day free trial."
            : "An owner or admin needs to choose a plan and add a payment method before your workspace can continue."}
        </div>
      </div>
      <div className="rounded-2xl border border-border bg-surface p-5 shadow-[var(--shadow-sm)]">
        {canManageBilling ? (
          <OnboardingPlanFlow />
        ) : (
          <p className="text-[13px] text-text-2">Please check back once your workspace admin has completed this step.</p>
        )}
      </div>
    </div>
  );
}
