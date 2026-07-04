import { requireProfile } from "@/lib/queries/session";
import { CompleteProfileForm } from "@/components/onboarding/CompleteProfileForm";

export default async function CompleteOnboardingPage() {
  const { profile, org } = await requireProfile();
  const canEditBusiness = profile.role === "owner" || profile.role === "admin";

  return (
    <div className="max-w-[520px] animate-fade-up">
      <div className="mb-[18px]">
        <div className="text-[22px] font-bold tracking-tight">Finish setting up your workspace</div>
        <div className="mt-[3px] text-text-2">
          {canEditBusiness
            ? "A couple of details are missing before you can continue."
            : "Please review and accept our Terms & Conditions to continue."}
        </div>
      </div>
      <div className="rounded-2xl border border-border bg-surface p-5 shadow-[var(--shadow-sm)]">
        <CompleteProfileForm
          canEditBusiness={canEditBusiness}
          businessName={org.name}
          businessEmail={org.business_email ?? ""}
          country={org.country ?? ""}
          state={org.state ?? ""}
          termsAccepted={profile.terms_accepted}
        />
      </div>
    </div>
  );
}
