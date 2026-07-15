"use server";

import crypto from "node:crypto";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { logAudit } from "@/lib/actions/audit";
import { planByKey } from "@/lib/billing-plans";
import { resolveAdminBillingContext, initiateAddCardForContext } from "@/lib/billing-service";
import {
  disableSubscription,
  enableSubscription,
  createSubscription,
  chargeAuthorization,
} from "@/lib/paystack";

function planCodeFor(interval: "monthly" | "yearly"): string {
  const code = interval === "monthly" ? process.env.PAYSTACK_PLAN_CODE_MONTHLY : process.env.PAYSTACK_PLAN_CODE_YEARLY;
  if (!code) throw new Error(`Paystack plan code for ${interval} is not configured.`);
  return code;
}

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
  const plan = planByKey(planKey);
  if (!plan || !plan.selectable) throw new Error("Invalid plan.");
  if (!subscription.authorization_code || !subscription.paystack_customer_code) {
    throw new Error("Add a payment method before choosing a plan.");
  }
  if (subscription.plan_key === planKey) return;

  if (subscription.paystack_subscription_code && subscription.paystack_email_token) {
    await disableSubscription({
      code: subscription.paystack_subscription_code,
      token: subscription.paystack_email_token,
    }).catch(() => {});
  }

  const effectiveFrom = subscription.current_period_end ? new Date(subscription.current_period_end) : new Date();
  const newSub = await createSubscription({
    customerCode: subscription.paystack_customer_code,
    planCode: planCodeFor(plan.interval as "monthly" | "yearly"),
    authorizationCode: subscription.authorization_code,
    startDate: effectiveFrom,
  });

  await supabase
    .from("subscriptions")
    .update({
      plan_key: planKey,
      billing_interval: plan.interval,
      amount: plan.price,
      paystack_subscription_code: newSub.subscription_code,
      paystack_email_token: newSub.email_token,
      paystack_plan_code: planCodeFor(plan.interval as "monthly" | "yearly"),
      cancel_at_period_end: false,
    })
    .eq("org_id", profile.org_id);

  await logAudit({
    orgId: profile.org_id,
    actorId: profile.id,
    actorName: `${profile.first_name} ${profile.last_name}`,
    actorRole: profile.role,
    action: "subscription.plan_changed",
    module: "Billing",
    entityType: "subscription",
    newValue: { plan_key: planKey },
  });

  revalidatePath("/billing");
}

// Removing the card stops future auto-renewal but never revokes access the
// customer already paid (or is trialing) for — access continues until
// current_period_end / trial_ends_at, at which point the cron sweep expires
// the subscription with no charge attempted.
export async function removePaymentMethod(): Promise<void> {
  const { supabase, profile, subscription } = await requireAdminContext();

  if (subscription.paystack_subscription_code && subscription.paystack_email_token) {
    await disableSubscription({
      code: subscription.paystack_subscription_code,
      token: subscription.paystack_email_token,
    }).catch(() => {
      // Already disabled/expired on Paystack's side — proceed with the
      // local removal regardless, since the goal is "no future charge."
    });
  }

  await supabase
    .from("subscriptions")
    .update({
      authorization_code: null,
      card_brand: null,
      card_last4: null,
      card_exp_month: null,
      card_exp_year: null,
      card_bank: null,
      cancel_at_period_end: true,
    })
    .eq("org_id", profile.org_id);

  await logAudit({
    orgId: profile.org_id,
    actorId: profile.id,
    actorName: `${profile.first_name} ${profile.last_name}`,
    actorRole: profile.role,
    action: "subscription.card_removed",
    module: "Billing",
    entityType: "subscription",
  });

  revalidatePath("/billing");
}

// User-initiated cancellation: access continues until the period already
// paid for ends, then the cron sweep marks it cancelled/expired.
export async function cancelSubscription(): Promise<void> {
  const { supabase, profile, subscription } = await requireAdminContext();

  if (subscription.paystack_subscription_code && subscription.paystack_email_token) {
    await disableSubscription({
      code: subscription.paystack_subscription_code,
      token: subscription.paystack_email_token,
    }).catch(() => {});
  }

  await supabase
    .from("subscriptions")
    .update({ cancel_at_period_end: true, cancelled_at: new Date().toISOString() })
    .eq("org_id", profile.org_id);

  await logAudit({
    orgId: profile.org_id,
    actorId: profile.id,
    actorName: `${profile.first_name} ${profile.last_name}`,
    actorRole: profile.role,
    action: "subscription.cancelled",
    module: "Billing",
    entityType: "subscription",
  });

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
  if (!subscription.authorization_code || !subscription.paystack_customer_code) {
    throw new Error("Add a payment method to reactivate your subscription.");
  }

  const plan = planByKey(subscription.plan_key) ?? planByKey("monthly")!;
  const reference = `reactivate_${profile.org_id}_${crypto.randomUUID()}`;
  const charge = await chargeAuthorization({
    authorizationCode: subscription.authorization_code,
    email: profile.email,
    amountNaira: plan.price,
    reference,
    metadata: { purpose: "recurring_charge", org_id: profile.org_id, plan_key: plan.key },
  });

  if (charge.status !== "success") {
    throw new Error(charge.gateway_response || "Card charge failed — try updating your payment method.");
  }

  let subscriptionCode = subscription.paystack_subscription_code;
  let emailToken = subscription.paystack_email_token;
  if (subscriptionCode && emailToken) {
    await enableSubscription({ code: subscriptionCode, token: emailToken }).catch(() => {});
  } else {
    const newSub = await createSubscription({
      customerCode: subscription.paystack_customer_code,
      planCode: planCodeFor((plan.interval ?? "monthly") as "monthly" | "yearly"),
      authorizationCode: subscription.authorization_code,
      startDate: new Date(),
    });
    subscriptionCode = newSub.subscription_code;
    emailToken = newSub.email_token;
  }

  const now = new Date();
  const periodEnd = new Date(now);
  if (plan.interval === "yearly") periodEnd.setFullYear(periodEnd.getFullYear() + 1);
  else periodEnd.setMonth(periodEnd.getMonth() + 1);

  await supabase
    .from("subscriptions")
    .update({
      status: "active",
      cancel_at_period_end: false,
      cancelled_at: null,
      failed_payment_count: 0,
      last_payment_error: null,
      next_retry_at: null,
      current_period_start: now.toISOString(),
      current_period_end: periodEnd.toISOString(),
      paystack_subscription_code: subscriptionCode,
      paystack_email_token: emailToken,
    })
    .eq("org_id", profile.org_id);

  await logAudit({
    orgId: profile.org_id,
    actorId: profile.id,
    actorName: `${profile.first_name} ${profile.last_name}`,
    actorRole: profile.role,
    action: "subscription.reactivated",
    module: "Billing",
    entityType: "subscription",
  });

  revalidatePath("/billing");
}
