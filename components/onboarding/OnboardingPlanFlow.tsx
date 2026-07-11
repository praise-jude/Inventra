"use client";

import { useState } from "react";
import { PlanSelectStep } from "@/components/onboarding/PlanSelectStep";
import { AddCardStep } from "@/components/onboarding/AddCardStep";

export function OnboardingPlanFlow() {
  const [step, setStep] = useState<"plan" | "card">("plan");
  const [planKey, setPlanKey] = useState<"monthly" | "yearly">("monthly");

  return step === "plan" ? (
    <PlanSelectStep selected={planKey} onSelect={setPlanKey} onContinue={() => setStep("card")} />
  ) : (
    <AddCardStep planKey={planKey} onBack={() => setStep("plan")} />
  );
}
