import "server-only";
import crypto from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { logAudit } from "@/lib/actions/audit";
import { planByKey } from "@/lib/billing-plans";
import { siteUrl } from "@/lib/site-url";
import {
  chargeAuthorization,
  createCustomer,
  createSubscription,
  disableSubscription,
  enableSubscription,
  initializeTransaction,
} from "@/lib/paystack";
import type { Subscription } from "@/lib/supabase/database.types";

export interface AdminBillingProfile {
  id: string;
  org_id: string;
  role: string;
  first_name: string;
  last_name: string;
  email: string;
}

export interface AdminBillingContext {
  profile: AdminBillingProfile;
  subscription: Subscription;
}

// Shared by lib/actions/billing.ts (web Server Actions, cookie-session auth)
// and app/api/mobile/billing/initiate-card (mobile route handler, bearer-JWT
// auth) so there is exactly one implementation of "resolve the authenticated
// org-admin context" regardless of how the caller authenticated.
export async function resolveAdminBillingContext(supabase: SupabaseClient): Promise<AdminBillingContext> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, org_id, role, first_name, last_name, email")
    .eq("id", user.id)
    .single();
  if (!profile) throw new Error("No profile");
  if (!["owner", "admin"].includes(profile.role)) {
    throw new Error("Only an owner or admin can manage billing.");
  }

  const { data: subscription } = await supabase
    .from("subscriptions")
    .select("*")
    .eq("org_id", profile.org_id)
    .single<Subscription>();
  if (!subscription) throw new Error("No subscription found for this organization.");

  return { profile, subscription };
}

export interface InitiateAddCardResult {
  authorizationUrl: string;
  // Lets a caller resume the same transaction with Paystack's Inline
  // popup (PaystackPop.resumeTransaction(accessCode)) instead of a full
  // redirect — the mobile app uses this inside a WebView so checkout
  // completes via an in-page onSuccess/onCancel callback rather than
  // needing a deep-link handoff from an external browser redirect.
  accessCode: string;
  reference: string;
}

// Kicks off card tokenization via Paystack's hosted checkout: a small ₦50
// charge (refunded once the webhook confirms and stores the authorization)
// so the app never touches raw card data. Used both by onboarding (new
// trial) and by "Update payment method" on an existing subscription, from
// both the web and mobile clients.
export async function initiateAddCardForContext(
  { profile, subscription }: AdminBillingContext,
  planKey: "monthly" | "yearly",
): Promise<InitiateAddCardResult> {
  const plan = planByKey(planKey);
  if (!plan || !plan.selectable) throw new Error("Invalid plan.");

  let customerCode = subscription.paystack_customer_code;
  if (!customerCode) {
    const customer = await createCustomer({
      email: profile.email,
      firstName: profile.first_name,
      lastName: profile.last_name,
      orgId: profile.org_id,
    });
    customerCode = customer.customer_code;
  }

  // Distinguishes a brand-new trial (no trial_ends_at yet) from swapping the
  // card on an already-running trial/subscription — the webhook must not
  // reset an active paying org back into a fresh trial just because they
  // updated their card.
  const mode = subscription.trial_ends_at ? "update" : "initial";

  const reference = `verify_${profile.org_id}_${crypto.randomUUID()}`;
  const origin = await siteUrl();
  // callback_url still matters even for the Inline-popup flow: some card
  // issuers force a full-page 3D Secure redirect away from the popup, and
  // Paystack lands the browser/WebView here afterward. Both web and mobile
  // share this one page — see app/(app)/onboarding/plan/callback/page.tsx.
  const { authorization_url, access_code } = await initializeTransaction({
    email: profile.email,
    amountNaira: 50,
    reference,
    callbackUrl: `${origin}/onboarding/plan/callback`,
    metadata: {
      purpose: "card_verification",
      mode,
      org_id: profile.org_id,
      plan_key: planKey,
      customer_code: customerCode,
    },
  });

  return { authorizationUrl: authorization_url, accessCode: access_code, reference };
}

function planCodeFor(interval: "monthly" | "yearly"): string {
  const code = interval === "monthly" ? process.env.PAYSTACK_PLAN_CODE_MONTHLY : process.env.PAYSTACK_PLAN_CODE_YEARLY;
  if (!code) throw new Error(`Paystack plan code for ${interval} is not configured.`);
  return code;
}

// Below: shared by lib/actions/billing.ts (web Server Actions, cookie-session
// auth, calls revalidatePath("/billing") after) and the bearer-JWT mobile
// routes under app/api/mobile/billing/ (which have no Next.js cache to
// revalidate) — same split responsibility as initiateAddCardForContext
// above. Each takes the caller's own already-authenticated `supabase`
// client so RLS scoping and audit-log attribution match however the caller
// authenticated.

// Switches plan/interval. Rather than prorating mid-cycle (out of scope and
// error-prone without a payments-accounting layer), the new plan takes
// effect at the next renewal: the current Paystack subscription is disabled
// and a new one created to start at the existing current_period_end, so the
// customer is never double-charged for the same period.
export async function changePlanForContext(
  supabase: SupabaseClient,
  { profile, subscription }: AdminBillingContext,
  planKey: "monthly" | "yearly",
): Promise<void> {
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

  await logAudit(
    {
      orgId: profile.org_id,
      actorId: profile.id,
      actorName: `${profile.first_name} ${profile.last_name}`,
      actorRole: profile.role,
      action: "subscription.plan_changed",
      module: "Billing",
      entityType: "subscription",
      newValue: { plan_key: planKey },
    },
    supabase,
  );
}

// Removing the card stops future auto-renewal but never revokes access the
// customer already paid (or is trialing) for — access continues until
// current_period_end / trial_ends_at, at which point the cron sweep expires
// the subscription with no charge attempted.
export async function removePaymentMethodForContext(
  supabase: SupabaseClient,
  { profile, subscription }: AdminBillingContext,
): Promise<void> {
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

  await logAudit(
    {
      orgId: profile.org_id,
      actorId: profile.id,
      actorName: `${profile.first_name} ${profile.last_name}`,
      actorRole: profile.role,
      action: "subscription.card_removed",
      module: "Billing",
      entityType: "subscription",
    },
    supabase,
  );
}

// User-initiated cancellation: access continues until the period already
// paid for ends, then the cron sweep marks it cancelled/expired.
export async function cancelSubscriptionForContext(
  supabase: SupabaseClient,
  { profile, subscription }: AdminBillingContext,
): Promise<void> {
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

  await logAudit(
    {
      orgId: profile.org_id,
      actorId: profile.id,
      actorName: `${profile.first_name} ${profile.last_name}`,
      actorRole: profile.role,
      action: "subscription.cancelled",
      module: "Billing",
      entityType: "subscription",
    },
    supabase,
  );
}

// Reactivates a subscription that was cancelled/expired/suspended/past_due.
// If a valid authorization is still on file, re-enable (or recreate) the
// Paystack subscription and attempt an immediate charge to restore access
// right away rather than waiting for the next scheduled cycle. If no
// authorization remains (card was removed), the caller must go through
// initiateAddCard again — this only handles the "card still valid" path.
export async function reactivateSubscriptionForContext(
  supabase: SupabaseClient,
  { profile, subscription }: AdminBillingContext,
): Promise<void> {
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

  await logAudit(
    {
      orgId: profile.org_id,
      actorId: profile.id,
      actorName: `${profile.first_name} ${profile.last_name}`,
      actorRole: profile.role,
      action: "subscription.reactivated",
      module: "Billing",
      entityType: "subscription",
    },
    supabase,
  );
}
