import { NextRequest, NextResponse } from "next/server";
import { verifyWebhookSignature, refundTransaction, createSubscription, disableSubscription } from "@/lib/paystack";
import { createAdminClient } from "@/lib/supabase/admin";
import { planByKey } from "@/lib/billing-plans";
import { sendTrialStartedEmail, sendSubscriptionCancelledEmail, sendPaymentMethodUpdatedEmail } from "@/lib/email";
import { addDays, recordSuccessfulCharge, recordFailedCharge, resolveOrgIdFromWebhookData } from "@/lib/billing-engine";

const TRIAL_DAYS = 6;

// Paystack signs every webhook with HMAC-SHA512 of the raw body — this is
// the only thing that authorizes a state change here. Client-side payment
// responses (the browser redirect back from checkout) are never trusted on
// their own; they only trigger a read-only verification call for fast UI
// feedback while this webhook is the actual source of truth.
export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const signature = req.headers.get("x-paystack-signature");
  if (!verifyWebhookSignature(rawBody, signature)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let body: { event: string; data: Record<string, any> };
  try {
    body = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const event = body.event;
  const data = body.data ?? {};
  const admin = createAdminClient();
  const reference: string | null = data.reference ?? data.subscription_code ?? null;
  const metadataOrgId: string | null = data.metadata?.org_id ?? null;

  if (reference) {
    const { data: existing } = await admin
      .from("paystack_webhook_events")
      .select("id, processed_at")
      .eq("event_type", event)
      .eq("reference", reference)
      .maybeSingle();
    if (existing?.processed_at) {
      return NextResponse.json({ received: true, duplicate: true });
    }
  }

  const { data: logRow } = await admin
    .from("paystack_webhook_events")
    .insert({ event_type: event, reference, org_id: metadataOrgId, payload: body })
    .select("id")
    .single();

  try {
    switch (event) {
      case "charge.success":
        await handleChargeSuccess(admin, data);
        break;
      case "charge.failed":
      case "invoice.payment_failed":
        await handleChargeFailed(admin, data);
        break;
      case "subscription.disable":
        await handleSubscriptionDisable(admin, data);
        break;
      case "subscription.not_renew":
        await handleSubscriptionNotRenew(admin, data);
        break;
      default:
        break; // logged above, no state change needed
    }
    if (logRow) {
      await admin.from("paystack_webhook_events").update({ processed_at: new Date().toISOString() }).eq("id", logRow.id);
    }
  } catch (err) {
    console.error(`[Inventra] Paystack webhook handler failed for "${event}":`, err);
    if (logRow) {
      await admin
        .from("paystack_webhook_events")
        .update({ processing_error: err instanceof Error ? err.message : String(err) })
        .eq("id", logRow.id);
    }
  }

  // Always 200 once accepted-for-processing — Paystack retries relentlessly
  // on any non-2xx response, which would otherwise cause duplicate deliveries.
  return NextResponse.json({ received: true });
}

async function handleChargeSuccess(admin: ReturnType<typeof createAdminClient>, data: Record<string, any>) {
  if (data.metadata?.purpose === "card_verification") {
    const orgId: string | null = data.metadata?.org_id ?? null;
    if (!orgId) return;

    // Net cost to the customer is ₦0 — refund the verification charge now
    // that the card is tokenized, regardless of which branch below runs.
    await refundTransaction(data.reference).catch((err) =>
      console.error("[Inventra] Failed to refund card-verification charge:", err),
    );

    if (data.metadata?.mode === "update") {
      await handleCardUpdate(admin, orgId, data);
    } else {
      await handleInitialCardVerification(admin, orgId, data);
    }
    return;
  }

  // Recurring/renewal charge — either Paystack's own subscription scheduler
  // firing automatically, or our own charge_authorization call (reactivation).
  const orgId = await resolveOrgIdFromWebhookData(admin, data);
  if (!orgId) return;
  await recordSuccessfulCharge(admin, orgId, {
    amountNaira: data.amount ? data.amount / 100 : 0,
    paystackReference: data.reference,
    customerEmail: data.customer?.email ?? null,
  });
}

// First-ever card verification for this org — starts the 6-day trial and
// creates the Paystack subscription (deferred to fire at trial end).
async function handleInitialCardVerification(admin: ReturnType<typeof createAdminClient>, orgId: string, data: Record<string, any>) {
  const planKey = (data.metadata?.plan_key as string) ?? "monthly";
  const plan = planByKey(planKey);
  const auth = data.authorization ?? {};
  const customerCode = data.customer?.customer_code ?? data.metadata?.customer_code;

  const trialStartedAt = new Date();
  const trialEndsAt = addDays(trialStartedAt, TRIAL_DAYS);

  let subscriptionCode: string | null = null;
  let emailToken: string | null = null;
  if (plan && customerCode && auth.authorization_code) {
    const planCode = plan.interval === "yearly" ? process.env.PAYSTACK_PLAN_CODE_YEARLY : process.env.PAYSTACK_PLAN_CODE_MONTHLY;
    if (planCode) {
      const created = await createSubscription({
        customerCode,
        planCode,
        authorizationCode: auth.authorization_code,
        startDate: trialEndsAt,
      }).catch((err) => {
        console.error("[Inventra] Failed to create Paystack subscription after card verification:", err);
        return null;
      });
      if (created) {
        subscriptionCode = created.subscription_code;
        emailToken = created.email_token;
      }
    }
  }

  await admin
    .from("subscriptions")
    .update({
      status: "trialing",
      plan_key: planKey,
      billing_interval: plan?.interval ?? null,
      amount: plan?.price ?? null,
      currency: "NGN",
      trial_started_at: trialStartedAt.toISOString(),
      trial_ends_at: trialEndsAt.toISOString(),
      paystack_customer_code: customerCode ?? undefined,
      paystack_subscription_code: subscriptionCode,
      paystack_email_token: emailToken,
      authorization_code: auth.authorization_code ?? null,
      card_brand: auth.card_type ?? null,
      card_last4: auth.last4 ?? null,
      card_exp_month: auth.exp_month ?? null,
      card_exp_year: auth.exp_year ?? null,
      card_bank: auth.bank ?? null,
    })
    .eq("org_id", orgId);

  const email = data.customer?.email;
  if (email) await sendTrialStartedEmail({ to: email, orgName: "there", trialEndsAt: trialEndsAt.toISOString() });
}

// Card swapped on an already-running trial/subscription — must NOT reset
// trial dates or billing status. Re-points the Paystack subscription (no
// direct "swap authorization" endpoint exists) at the same next-charge date
// so timing is unaffected, only the card on file changes.
async function handleCardUpdate(admin: ReturnType<typeof createAdminClient>, orgId: string, data: Record<string, any>) {
  const auth = data.authorization ?? {};
  const customerCode = data.customer?.customer_code ?? data.metadata?.customer_code;
  if (!auth.authorization_code) return;

  const { data: subscription } = await admin.from("subscriptions").select("*").eq("org_id", orgId).single();
  if (!subscription) return;

  // A card re-add can also carry a plan change (BillingClient routes "choose
  // a plan while no card is on file" through this same add-card flow) — use
  // the requested plan if one was sent, falling back to the existing plan.
  const requestedPlanKey = (data.metadata?.plan_key as string) ?? subscription.plan_key;
  const requestedPlan = planByKey(requestedPlanKey) ?? planByKey(subscription.plan_key);
  const billingInterval = requestedPlan?.interval ?? subscription.billing_interval;

  let subscriptionCode = subscription.paystack_subscription_code;
  let emailToken = subscription.paystack_email_token;
  const nextChargeAt = subscription.status === "trialing" ? subscription.trial_ends_at : subscription.current_period_end;
  const planCode = billingInterval === "yearly" ? process.env.PAYSTACK_PLAN_CODE_YEARLY : process.env.PAYSTACK_PLAN_CODE_MONTHLY;

  if (subscriptionCode && emailToken) {
    await disableSubscription({ code: subscriptionCode, token: emailToken }).catch(() => {});
  }
  if (planCode && customerCode) {
    const created = await createSubscription({
      customerCode,
      planCode,
      authorizationCode: auth.authorization_code,
      startDate: nextChargeAt ? new Date(nextChargeAt) : new Date(),
    }).catch((err) => {
      console.error("[Inventra] Failed to re-create Paystack subscription after card update:", err);
      return null;
    });
    if (created) {
      subscriptionCode = created.subscription_code;
      emailToken = created.email_token;
    }
  }

  await admin
    .from("subscriptions")
    .update({
      plan_key: requestedPlanKey,
      billing_interval: billingInterval,
      amount: requestedPlan?.price ?? subscription.amount,
      paystack_customer_code: customerCode ?? subscription.paystack_customer_code,
      paystack_subscription_code: subscriptionCode,
      paystack_email_token: emailToken,
      paystack_plan_code: planCode ?? subscription.paystack_plan_code,
      authorization_code: auth.authorization_code,
      card_brand: auth.card_type ?? null,
      card_last4: auth.last4 ?? null,
      card_exp_month: auth.exp_month ?? null,
      card_exp_year: auth.exp_year ?? null,
      card_bank: auth.bank ?? null,
    })
    .eq("org_id", orgId);

  const email = data.customer?.email;
  if (email && auth.card_type && auth.last4) {
    await sendPaymentMethodUpdatedEmail({ to: email, orgName: "there", cardBrand: auth.card_type, last4: auth.last4 });
  }
}

async function handleChargeFailed(admin: ReturnType<typeof createAdminClient>, data: Record<string, any>) {
  const orgId = await resolveOrgIdFromWebhookData(admin, data);
  if (!orgId) return;
  await recordFailedCharge(admin, orgId, {
    amountNaira: data.amount ? data.amount / 100 : 0,
    paystackReference: data.reference ?? null,
    failureReason: data.gateway_response ?? "Payment failed",
    customerEmail: data.customer?.email ?? null,
  });
}

async function handleSubscriptionDisable(admin: ReturnType<typeof createAdminClient>, data: Record<string, any>) {
  const orgId = await resolveOrgIdFromWebhookData(admin, data);
  if (!orgId) return;
  const { data: subscription } = await admin.from("subscriptions").select("status, cancelled_at").eq("org_id", orgId).single();
  if (!subscription || subscription.status === "cancelled") return;

  const now = new Date().toISOString();
  await admin.from("subscriptions").update({ status: "cancelled", cancelled_at: subscription.cancelled_at ?? now }).eq("org_id", orgId);

  const email = data.customer?.email;
  if (email) await sendSubscriptionCancelledEmail({ to: email, orgName: "there", accessUntil: now });
}

async function handleSubscriptionNotRenew(admin: ReturnType<typeof createAdminClient>, data: Record<string, any>) {
  const orgId = await resolveOrgIdFromWebhookData(admin, data);
  if (!orgId) return;
  await admin.from("subscriptions").update({ cancel_at_period_end: true }).eq("org_id", orgId);
}
