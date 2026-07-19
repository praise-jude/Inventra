import crypto from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { chargeAuthorization } from "@/lib/paystack";
import { planByKey } from "@/lib/billing-plans";
import { sendTrialEndingEmail, sendTrialExpiredEmail, sendRenewalReminderEmail } from "@/lib/email";
import { recordSuccessfulCharge, recordFailedCharge } from "@/lib/billing-engine";

// Runs once/day (Vercel Cron on the Hobby tier caps at 1 run/day — see
// vercel.json). Paystack's own Subscriptions API is the primary billing
// trigger, firing in real time via webhooks; this sweep only handles what
// Paystack has no way to know about: our own trial-reminder emails, expiring
// a trial that was never converted (no card, or explicitly cancelled), a
// safety-net reconciliation charge if a webhook was somehow never delivered,
// and finalizing subscriptions the user scheduled to cancel at period end.
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization") ?? "";
  const expected = `Bearer ${process.env.CRON_SECRET ?? ""}`;
  const authBuf = Buffer.from(authHeader);
  const expectedBuf = Buffer.from(expected);
  const isAuthorized =
    authBuf.length === expectedBuf.length && crypto.timingSafeEqual(authBuf, expectedBuf);
  if (!isAuthorized) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const now = new Date();
  const results = {
    reminders: 0,
    renewalReminders: 0,
    expired: 0,
    reconciled: 0,
    finalizedCancellations: 0,
    errors: [] as string[],
  };

  // --- Trial reminder emails (3 / 2 / 1 days before trial_ends_at) ---
  const { data: trialing } = await admin
    .from("subscriptions")
    .select("org_id, trial_ends_at, trial_reminders_sent")
    .eq("status", "trialing")
    .not("trial_ends_at", "is", null)
    .gt("trial_ends_at", now.toISOString());

  for (const sub of trialing ?? []) {
    try {
      const daysLeft = Math.ceil((new Date(sub.trial_ends_at).getTime() - now.getTime()) / 86_400_000);
      if (daysLeft === 3 && sub.trial_reminders_sent < 1) {
        await sendReminder(admin, sub.org_id, sub.trial_ends_at, 3);
        await admin.from("subscriptions").update({ trial_reminders_sent: 1 }).eq("org_id", sub.org_id);
        results.reminders++;
      } else if (daysLeft === 2 && sub.trial_reminders_sent < 2) {
        await sendReminder(admin, sub.org_id, sub.trial_ends_at, 2);
        await admin.from("subscriptions").update({ trial_reminders_sent: 2 }).eq("org_id", sub.org_id);
        results.reminders++;
      } else if (daysLeft === 1 && sub.trial_reminders_sent < 3) {
        await sendReminder(admin, sub.org_id, sub.trial_ends_at, 1);
        await admin.from("subscriptions").update({ trial_reminders_sent: 3 }).eq("org_id", sub.org_id);
        results.reminders++;
      }
    } catch (err) {
      results.errors.push(`reminder ${sub.org_id}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  // --- Renewal reminder emails (3 days before a paying subscription's next
  //     auto-charge) — distinct from the trial reminders above. ---
  const threeDaysOut = new Date(now.getTime() + 3 * 86_400_000);
  const { data: renewingSoon } = await admin
    .from("subscriptions")
    .select("org_id, plan_key, amount, current_period_end")
    .eq("status", "active")
    .eq("renewal_reminder_sent", false)
    .not("current_period_end", "is", null)
    .lte("current_period_end", threeDaysOut.toISOString())
    .gt("current_period_end", now.toISOString());

  for (const sub of renewingSoon ?? []) {
    try {
      const { data: profile } = await admin
        .from("profiles")
        .select("email")
        .eq("org_id", sub.org_id)
        .eq("role", "owner")
        .single();
      if (profile?.email) {
        const plan = planByKey(sub.plan_key);
        await sendRenewalReminderEmail({
          to: profile.email,
          orgName: "there",
          amount: sub.amount ?? plan?.price ?? 0,
          renewsAt: sub.current_period_end,
        });
      }
      await admin.from("subscriptions").update({ renewal_reminder_sent: true }).eq("org_id", sub.org_id);
      results.renewalReminders++;
    } catch (err) {
      results.errors.push(`renewal-reminder ${sub.org_id}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  // --- Trials that ended: expire (no card / explicitly cancelled) or
  //     reconcile (card on file, no conversion recorded yet — safety net) ---
  const { data: endedTrials } = await admin
    .from("subscriptions")
    .select("*")
    .eq("status", "trialing")
    .not("trial_ends_at", "is", null)
    .lt("trial_ends_at", now.toISOString());

  for (const sub of endedTrials ?? []) {
    try {
      if (sub.cancel_at_period_end || !sub.authorization_code) {
        await admin.from("subscriptions").update({ status: "expired" }).eq("org_id", sub.org_id);
        const { data: ownerProfile } = await admin
          .from("profiles")
          .select("email")
          .eq("org_id", sub.org_id)
          .eq("role", "owner")
          .single();
        if (ownerProfile?.email) {
          await sendTrialExpiredEmail({ to: ownerProfile.email, orgName: "there" });
        }
        results.expired++;
        continue;
      }
      // Grace window: Paystack's own subscription schedule should have
      // already converted this via webhook. Only step in if it's been more
      // than 12h past trial_ends_at with still no recorded conversion.
      const gracePassed = now.getTime() - new Date(sub.trial_ends_at).getTime() > 12 * 60 * 60 * 1000;
      if (!gracePassed || sub.current_period_start) continue;

      const plan = planByKey(sub.plan_key);
      if (!plan) continue;
      const { data: profile } = await admin.from("profiles").select("email").eq("org_id", sub.org_id).eq("role", "owner").single();
      const reference = `reconcile_${sub.org_id}_${now.getTime()}`;
      const charge = await chargeAuthorization({
        authorizationCode: sub.authorization_code,
        email: profile?.email ?? "",
        amountNaira: plan.price,
        reference,
        metadata: { purpose: "recurring_charge", org_id: sub.org_id, plan_key: plan.key },
      });
      if (charge.status === "success") {
        await recordSuccessfulCharge(admin, sub.org_id, {
          amountNaira: plan.price,
          paystackReference: reference,
          customerEmail: profile?.email ?? null,
        });
      } else {
        await recordFailedCharge(admin, sub.org_id, {
          amountNaira: plan.price,
          paystackReference: reference,
          failureReason: charge.gateway_response || "Reconciliation charge failed",
          customerEmail: profile?.email ?? null,
        });
      }
      results.reconciled++;
    } catch (err) {
      results.errors.push(`trial-end ${sub.org_id}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  // --- Finalize subscriptions scheduled to cancel at period end ---
  const { data: scheduledCancellations } = await admin
    .from("subscriptions")
    .select("org_id")
    .in("status", ["active", "past_due", "suspended"])
    .eq("cancel_at_period_end", true)
    .not("current_period_end", "is", null)
    .lt("current_period_end", now.toISOString());

  for (const sub of scheduledCancellations ?? []) {
    await admin.from("subscriptions").update({ status: "cancelled" }).eq("org_id", sub.org_id);
    results.finalizedCancellations++;
  }

  return NextResponse.json({ ok: true, ranAt: now.toISOString(), ...results });
}

async function sendReminder(admin: ReturnType<typeof createAdminClient>, orgId: string, trialEndsAt: string, daysLeft: 1 | 2 | 3) {
  const { data: profile } = await admin.from("profiles").select("email").eq("org_id", orgId).eq("role", "owner").single();
  if (!profile?.email) return;
  await sendTrialEndingEmail({ to: profile.email, orgName: "there", trialEndsAt, daysLeft });
}
