"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  resolveAdminBillingContext,
  initiateAddCardForContext,
  changePlanForContext,
  removePaymentMethodForContext,
  cancelSubscriptionForContext,
  reactivateSubscriptionForContext,
} from "@/lib/billing-service";

async function requireAdminContext() {
  const supabase = await createClient();
  const { profile, subscription } = await resolveAdminBillingContext(supabase);
  return { supabase, profile, subscription };
}

// Kicks off card tokenization via Paystack's hosted checkout: a small ₦50
// charge (refunded once the webhook confirms and stores the authorization)
// so the app never touches raw card data. Used both by onboarding (new
// trial) and by "Update payment method" on an existing subscription.
// Actual Paystack calls live in lib/billing-service.ts, shared with the
// mobile app's app/api/mobile/billing/initiate-card route.
export async function initiateAddCard(planKey: "monthly" | "yearly"): Promise<{ authorizationUrl: string }> {
  const { profile, subscription } = await requireAdminContext();
  return initiateAddCardForContext({ profile, subscription }, planKey);
}

// Switches plan/interval. Rather than prorating mid-cycle (out of scope and
// error-prone without a payments-accounting layer), the new plan takes
// effect at the next renewal: the current Paystack subscription is disabled
// and a new one created to start at the existing current_period_end, so the
// customer is never double-charged for the same period.
export async function changePlan(planKey: "monthly" | "yearly"): Promise<void> {
  const { supabase, profile, subscription } = await requireAdminContext();
  await changePlanForContext(supabase, { profile, subscription }, planKey);
  revalidatePath("/billing");
}

// Removing the card stops future auto-renewal but never revokes access the
// customer already paid (or is trialing) for — access continues until
// current_period_end / trial_ends_at, at which point the cron sweep expires
// the subscription with no charge attempted.
export async function removePaymentMethod(): Promise<void> {
  const { supabase, profile, subscription } = await requireAdminContext();
  await removePaymentMethodForContext(supabase, { profile, subscription });
  revalidatePath("/billing");
}

// User-initiated cancellation: access continues until the period already
// paid for ends, then the cron sweep marks it cancelled/expired.
export async function cancelSubscription(): Promise<void> {
  const { supabase, profile, subscription } = await requireAdminContext();
  await cancelSubscriptionForContext(supabase, { profile, subscription });
  revalidatePath("/billing");
}

// Reactivates a subscription that was cancelled/expired/suspended/past_due.
// If a valid authorization is still on file, re-enable (or recreate) the
// Paystack subscription and attempt an immediate charge to restore access
// right away rather than waiting for the next scheduled cycle. If no
// authorization remains (card was removed), the caller must go through
// initiateAddCard again — this action only handles the "card still valid"
// path.
export async function reactivateSubscription(): Promise<void> {
  const { supabase, profile, subscription } = await requireAdminContext();
  await reactivateSubscriptionForContext(supabase, { profile, subscription });
  revalidatePath("/billing");
}
