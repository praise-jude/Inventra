import "server-only";
import crypto from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { planByKey } from "@/lib/billing-plans";
import {
  sendPaymentSuccessEmail,
  sendSubscriptionRenewedEmail,
  sendPaymentFailedEmail,
  sendSubscriptionCancelledEmail,
} from "@/lib/email";

type AdminClient = ReturnType<typeof createAdminClient>;

export function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

export function addInterval(date: Date, interval: "monthly" | "yearly" | null): Date {
  const d = new Date(date);
  if (interval === "yearly") d.setFullYear(d.getFullYear() + 1);
  else d.setMonth(d.getMonth() + 1);
  return d;
}

export function invoiceNumber(): string {
  return `INV-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
}

// Shared by both the webhook handler (Paystack-initiated recurring charges)
// and the cron safety net (our own reconciliation charge) — keeping this in
// one place avoids the two entry points ever disagreeing on what "a
// successful charge" does to subscription/invoice state.
export async function recordSuccessfulCharge(
  admin: AdminClient,
  orgId: string,
  input: { amountNaira: number; paystackReference: string; customerEmail: string | null },
): Promise<void> {
  const { data: subscription } = await admin.from("subscriptions").select("*").eq("org_id", orgId).single();
  if (!subscription) return;

  const wasTrialing = subscription.status === "trialing";
  const now = new Date();
  const periodEnd = addInterval(now, subscription.billing_interval);
  const newInvoiceNumber = invoiceNumber();

  const { data: invoice } = await admin
    .from("invoices")
    .insert({
      org_id: orgId,
      invoice_number: newInvoiceNumber,
      amount: input.amountNaira,
      status: "paid",
      issued_at: now.toISOString().slice(0, 10),
      paystack_reference: input.paystackReference,
      plan_key: subscription.plan_key,
      billing_interval: subscription.billing_interval,
      period_start: now.toISOString().slice(0, 10),
      period_end: periodEnd.toISOString().slice(0, 10),
      paid_at: now.toISOString(),
    })
    .select("id")
    .single();

  await admin.from("payment_attempts").insert({
    org_id: orgId,
    invoice_id: invoice?.id ?? null,
    attempt_number: subscription.failed_payment_count + 1,
    status: "success",
    amount: input.amountNaira,
    paystack_reference: input.paystackReference,
  });

  await admin
    .from("subscriptions")
    .update({
      status: "active",
      current_period_start: now.toISOString(),
      current_period_end: periodEnd.toISOString(),
      failed_payment_count: 0,
      last_payment_error: null,
      next_retry_at: null,
      last_payment_attempt_at: now.toISOString(),
      renewal_reminder_sent: false,
    })
    .eq("org_id", orgId);

  if (!input.customerEmail) return;
  const plan = planByKey(subscription.plan_key);
  if (wasTrialing) {
    await sendPaymentSuccessEmail({
      to: input.customerEmail,
      orgName: "there",
      amount: input.amountNaira,
      planLabel: plan?.name ?? subscription.plan_key,
      periodEnd: periodEnd.toISOString(),
      invoiceNumber: newInvoiceNumber,
    });
  } else {
    await sendSubscriptionRenewedEmail({
      to: input.customerEmail,
      orgName: "there",
      planLabel: plan?.name ?? subscription.plan_key,
      periodEnd: periodEnd.toISOString(),
    });
  }
}

// Dunning ladder: 1st failure -> past_due (retry ~24h), 2nd -> past_due
// (retry ~48h), 3rd -> suspended/access blocked (retry ~72h), 4th -> cancelled.
export async function recordFailedCharge(
  admin: AdminClient,
  orgId: string,
  input: { amountNaira: number; paystackReference: string | null; failureReason: string; customerEmail: string | null },
): Promise<void> {
  const { data: subscription } = await admin.from("subscriptions").select("*").eq("org_id", orgId).single();
  if (!subscription) return;

  const attemptNumber = subscription.failed_payment_count + 1;
  const now = new Date();

  await admin.from("payment_attempts").insert({
    org_id: orgId,
    attempt_number: attemptNumber,
    status: "failed",
    amount: input.amountNaira,
    paystack_reference: input.paystackReference,
    failure_reason: input.failureReason,
  });

  let status: "past_due" | "suspended" | "cancelled" = "past_due";
  let nextRetryAt: Date | null = addDays(now, 1);
  if (attemptNumber === 2) nextRetryAt = addDays(now, 2);
  else if (attemptNumber === 3) {
    status = "suspended";
    nextRetryAt = addDays(now, 3);
  } else if (attemptNumber >= 4) {
    status = "cancelled";
    nextRetryAt = null;
  }

  await admin
    .from("subscriptions")
    .update({
      status,
      failed_payment_count: attemptNumber,
      last_payment_attempt_at: now.toISOString(),
      last_payment_error: input.failureReason,
      next_retry_at: nextRetryAt ? nextRetryAt.toISOString() : null,
      cancelled_at: status === "cancelled" ? now.toISOString() : subscription.cancelled_at,
    })
    .eq("org_id", orgId);

  if (!input.customerEmail) return;
  if (status === "cancelled") {
    await sendSubscriptionCancelledEmail({ to: input.customerEmail, orgName: "there", accessUntil: now.toISOString() });
  } else {
    await sendPaymentFailedEmail({
      to: input.customerEmail,
      orgName: "there",
      amount: input.amountNaira,
      reason: input.failureReason,
    });
  }
}

export async function resolveOrgIdFromWebhookData(
  admin: AdminClient,
  data: { metadata?: { org_id?: string } | null; customer?: { customer_code?: string } | null },
): Promise<string | null> {
  const metadataOrgId = data.metadata?.org_id ?? null;
  if (metadataOrgId) return metadataOrgId;
  const customerCode = data.customer?.customer_code;
  if (!customerCode) return null;
  const { data: sub } = await admin.from("subscriptions").select("org_id").eq("paystack_customer_code", customerCode).maybeSingle();
  return sub?.org_id ?? null;
}
