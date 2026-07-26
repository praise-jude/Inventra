import "server-only";
import { Resend } from "resend";
import { formatMoney } from "@/lib/currency";

const FROM_ADDRESS = process.env.RESEND_FROM_EMAIL ?? "billing@inventra.app";

function getResend(): Resend | null {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return null;
  return new Resend(apiKey);
}

async function sendEmail(input: { to: string; subject: string; html: string }): Promise<void> {
  const resend = getResend();
  if (!resend) {
    // No RESEND_API_KEY configured — log instead of throwing so billing
    // flows (trial start, charges, cancellation) never fail because a
    // notification couldn't be sent.
    console.warn(`[Inventra] RESEND_API_KEY not set — skipped email "${input.subject}" to ${input.to}`);
    return;
  }
  try {
    await resend.emails.send({ from: FROM_ADDRESS, to: input.to, subject: input.subject, html: input.html });
  } catch (err) {
    console.error(`[Inventra] Failed to send email "${input.subject}" to ${input.to}:`, err);
  }
}

function wrap(title: string, bodyHtml: string): string {
  return `<div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;max-width:520px;margin:0 auto;padding:24px">
    <h2 style="margin:0 0 16px;font-size:20px;color:#111">${title}</h2>
    ${bodyHtml}
    <p style="margin-top:32px;font-size:12.5px;color:#888">— The Inventra team</p>
  </div>`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });
}

// Only needed here: every other email in this file interpolates
// server-trusted values (org names, admin-entered reasons); the
// account-deletion emails below are the first to embed input straight from
// an unauthenticated public form.
function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

export async function sendWelcomeEmail(input: { to: string; orgName: string }): Promise<void> {
  await sendEmail({
    to: input.to,
    subject: "Welcome to Inventra",
    html: wrap(
      "Welcome to Inventra",
      `<p>Hi ${input.orgName},</p>
       <p>Your account is ready. Sign in anytime to set up your inventory, invite your team, and start tracking sales.</p>
       <p>If you haven't added a payment method yet, you can start your 6-day free trial from Settings → Billing &amp; Subscription — no charge until it ends.</p>`,
    ),
  });
}

// Phase F: upgrading from Free to Premium activates immediately (no more
// 6-day trial) — this replaces sendTrialStartedEmail for that flow.
// sendTrialStartedEmail/sendTrialEndingEmail are left in place (unused by
// any reachable code path post-Phase-F, since no org can enter 'trialing'
// anymore) rather than deleted, in case grandfathered-era data or the
// billing-sweep cron still references their shape.
export async function sendPremiumActivatedEmail(input: { to: string; orgName: string; periodEndsAt: string }): Promise<void> {
  await sendEmail({
    to: input.to,
    subject: "You're on Inventra Premium",
    html: wrap(
      "Welcome to Premium",
      `<p>Hi ${input.orgName},</p>
       <p>Your card has been charged and Premium is active now — unlimited products, sales, receipt printing, inventory editing, reports, AI tools, team management, and every other Premium feature are unlocked immediately.</p>
       <p>Your subscription renews on <strong>${formatDate(input.periodEndsAt)}</strong>. You can manage your plan and payment method anytime from Settings → Billing &amp; Subscription.</p>`,
    ),
  });
}

export async function sendTrialStartedEmail(input: { to: string; orgName: string; trialEndsAt: string }): Promise<void> {
  await sendEmail({
    to: input.to,
    subject: "Your Inventra free trial has started",
    html: wrap(
      "Your 6-day free trial has started",
      `<p>Hi ${input.orgName},</p>
       <p>Your free trial is now active and runs until <strong>${formatDate(input.trialEndsAt)}</strong>. No charge has been made — your card is only tokenized to activate automatic billing once the trial ends.</p>
       <p>You can manage your plan and payment method anytime from Settings → Billing &amp; Subscription.</p>`,
    ),
  });
}

export async function sendTrialEndingEmail(input: {
  to: string;
  orgName: string;
  trialEndsAt: string;
  daysLeft: 1 | 2 | 3;
}): Promise<void> {
  await sendEmail({
    to: input.to,
    subject: `Your Inventra trial ends in ${input.daysLeft} day${input.daysLeft > 1 ? "s" : ""}`,
    html: wrap(
      `Your trial ends in ${input.daysLeft} day${input.daysLeft > 1 ? "s" : ""}`,
      `<p>Hi ${input.orgName},</p>
       <p>Your free trial ends on <strong>${formatDate(input.trialEndsAt)}</strong>. Your saved card will be charged automatically to continue your subscription — no action is needed if you'd like to continue.</p>
       <p>To change your plan or payment method first, visit Settings → Billing &amp; Subscription.</p>`,
    ),
  });
}

// Fires when a trial ends without ever converting to a paid subscription
// (no card on file, or explicitly cancelled before conversion) — see the
// cron sweep's endedTrials loop. Paying subscriptions never reach "expired"
// in this app's state machine; a failed-renewal subscription instead moves
// through past_due -> suspended -> cancelled (see recordFailedCharge),
// which already have their own emails. So this is the one real
// "expired" event, covering both "trial expired" and "subscription
// expired" from a user's perspective.
export async function sendTrialExpiredEmail(input: { to: string; orgName: string }): Promise<void> {
  await sendEmail({
    to: input.to,
    subject: "Your Inventra trial has ended",
    html: wrap(
      "Your trial has ended",
      `<p>Hi ${input.orgName},</p>
       <p>Your free trial has ended and access to your Inventra workspace is now restricted. Add a payment method to reactivate your subscription — your data is safe and waiting for you.</p>
       <p>Reactivate anytime from Settings → Billing &amp; Subscription.</p>`,
    ),
  });
}

// A heads-up a few days before a paying (non-trial) subscription's next
// auto-charge — distinct from sendTrialEndingEmail, which only applies
// during the trial. See the cron sweep's renewal-reminder block.
export async function sendRenewalReminderEmail(input: {
  to: string;
  orgName: string;
  amount: number;
  renewsAt: string;
}): Promise<void> {
  await sendEmail({
    to: input.to,
    subject: "Your Inventra subscription renews soon",
    html: wrap(
      "Your subscription renews soon",
      `<p>Hi ${input.orgName},</p>
       <p>Your subscription will automatically renew on <strong>${formatDate(input.renewsAt)}</strong> for <strong>${formatMoney(input.amount, "NGN")}</strong>, charged to your card on file.</p>
       <p>To change your plan or payment method first, visit Settings → Billing &amp; Subscription.</p>`,
    ),
  });
}

export async function sendPaymentSuccessEmail(input: {
  to: string;
  orgName: string;
  amount: number;
  planLabel: string;
  periodEnd: string;
  invoiceNumber: string;
}): Promise<void> {
  await sendEmail({
    to: input.to,
    subject: "Payment received — thank you",
    html: wrap(
      "Payment received",
      `<p>Hi ${input.orgName},</p>
       <p>We've received your payment of <strong>${formatMoney(input.amount, "NGN")}</strong> for the ${input.planLabel} plan. Your subscription is active until <strong>${formatDate(input.periodEnd)}</strong>.</p>
       <p>Invoice ${input.invoiceNumber} is available under Settings → Billing &amp; Subscription.</p>`,
    ),
  });
}

export async function sendPaymentFailedEmail(input: {
  to: string;
  orgName: string;
  amount: number;
  reason?: string;
}): Promise<void> {
  await sendEmail({
    to: input.to,
    subject: "We couldn't process your payment",
    html: wrap(
      "Payment failed",
      `<p>Hi ${input.orgName},</p>
       <p>We tried to charge your card <strong>${formatMoney(input.amount, "NGN")}</strong> but the payment didn't go through${input.reason ? ` (${input.reason})` : ""}.</p>
       <p>Please update your payment method under Settings → Billing &amp; Subscription to avoid losing access to your account.</p>`,
    ),
  });
}

export async function sendSubscriptionRenewedEmail(input: {
  to: string;
  orgName: string;
  planLabel: string;
  periodEnd: string;
}): Promise<void> {
  await sendEmail({
    to: input.to,
    subject: "Your Inventra subscription has renewed",
    html: wrap(
      "Subscription renewed",
      `<p>Hi ${input.orgName},</p>
       <p>Your ${input.planLabel} subscription has renewed and is active until <strong>${formatDate(input.periodEnd)}</strong>.</p>`,
    ),
  });
}

export async function sendSubscriptionCancelledEmail(input: { to: string; orgName: string; accessUntil: string }): Promise<void> {
  await sendEmail({
    to: input.to,
    subject: "Your Inventra subscription has been cancelled",
    html: wrap(
      "Subscription cancelled",
      `<p>Hi ${input.orgName},</p>
       <p>Your subscription has been cancelled. You'll keep access until <strong>${formatDate(input.accessUntil)}</strong>, after which your account will be restricted until you resubscribe.</p>
       <p>Changed your mind? You can reactivate anytime from Settings → Billing &amp; Subscription before that date.</p>`,
    ),
  });
}

export async function sendPaymentMethodUpdatedEmail(input: { to: string; orgName: string; cardBrand: string; last4: string }): Promise<void> {
  await sendEmail({
    to: input.to,
    subject: "Your payment method was updated",
    html: wrap(
      "Payment method updated",
      `<p>Hi ${input.orgName},</p>
       <p>Your payment method was updated to a ${input.cardBrand} card ending in <strong>${input.last4}</strong>. Future charges will use this card.</p>
       <p>If you didn't make this change, please contact support immediately.</p>`,
    ),
  });
}

export async function sendMfaEnabledEmail(input: { to: string }): Promise<void> {
  await sendEmail({
    to: input.to,
    subject: "Two-factor authentication enabled",
    html: wrap(
      "Two-factor authentication enabled",
      `<p>Two-factor authentication was just turned on for your Inventra account. You'll now be asked for a code from your authenticator app each time you sign in.</p>
       <p>If you didn't make this change, please contact support immediately.</p>`,
    ),
  });
}

export async function sendMfaDisabledEmail(input: { to: string }): Promise<void> {
  await sendEmail({
    to: input.to,
    subject: "Two-factor authentication disabled",
    html: wrap(
      "Two-factor authentication disabled",
      `<p>Two-factor authentication was just turned off for your Inventra account. Signing in now only requires your password.</p>
       <p>If you didn't make this change, please contact support immediately and change your password.</p>`,
    ),
  });
}

export async function sendRecoveryCodeUsedEmail(input: { to: string }): Promise<void> {
  await sendEmail({
    to: input.to,
    subject: "A recovery code was used on your account",
    html: wrap(
      "A recovery code was used",
      `<p>One of your two-factor recovery codes was just used to sign in to your Inventra account.</p>
       <p>If this wasn't you, please contact support immediately and change your password.</p>`,
    ),
  });
}

export async function sendMemberApprovedEmail(input: { to: string; orgName: string }): Promise<void> {
  await sendEmail({
    to: input.to,
    subject: "Your Inventra account has been approved",
    html: wrap(
      "You're approved",
      `<p>Your ${input.orgName} account has been approved. You can now log in and access your assigned branch.</p>`,
    ),
  });
}

export async function sendMemberRejectedEmail(input: { to: string; reason: string }): Promise<void> {
  await sendEmail({
    to: input.to,
    subject: "Your Inventra account request was not approved",
    html: wrap(
      "Account request declined",
      `<p>Your request to join this workspace was not approved.</p><p><strong>Reason:</strong> ${input.reason}</p><p>If you believe this is a mistake, contact whoever invited you.</p>`,
    ),
  });
}

// Notifies the privacy inbox of a deletion request submitted via the public
// /delete-account page (app/delete-account/page.tsx) — there's no self-serve
// deletion flow in-app yet, so a human on the team actions this manually,
// same as the process already described in the Privacy Policy.
export async function sendAccountDeletionRequestEmail(input: {
  requesterEmail: string;
  businessName: string;
  details: string;
}): Promise<void> {
  const inbox = process.env.PRIVACY_CONTACT_EMAIL ?? "privacy@royalinventra.com.ng";
  await sendEmail({
    to: inbox,
    subject: `Account deletion request — ${input.requesterEmail}`,
    html: wrap(
      "Account deletion request",
      `<p>Requester email: <strong>${escapeHtml(input.requesterEmail)}</strong></p>
       <p>Business/organization: ${input.businessName ? escapeHtml(input.businessName) : "(not provided)"}</p>
       <p>Details: ${input.details ? escapeHtml(input.details) : "(none provided)"}</p>
       <p>Submitted via the public account-deletion page.</p>`,
    ),
  });
}

// Sent straight back to whatever address the requester typed in, so they
// have their own record that the request went through even if the team
// hasn't actioned it yet.
export async function sendAccountDeletionAckEmail(input: { to: string }): Promise<void> {
  await sendEmail({
    to: input.to,
    subject: "We've received your account deletion request",
    html: wrap(
      "Request received",
      `<p>We've received your request to delete your Royal Inventra account and associated data.</p>
       <p>We'll verify the request and complete the deletion within 30 days, then send a final confirmation to this email address. Some records (e.g. billing history) may be retained longer where required for legal or accounting purposes.</p>
       <p>If you didn't make this request, please reply to this email immediately.</p>`,
    ),
  });
}
