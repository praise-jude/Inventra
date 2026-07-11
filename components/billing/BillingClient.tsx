"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/app/ToastProvider";
import {
  initiateAddCard,
  changePlan,
  removePaymentMethod,
  cancelSubscription,
  reactivateSubscription,
} from "@/lib/actions/billing";
import { PLANS, planByKey } from "@/lib/billing-plans";
import { formatMoney } from "@/lib/currency";
import { exportInvoicePdf } from "@/lib/export";
import { useWorkspace } from "@/components/app/CurrencyProvider";
import { PricingPlans } from "@/components/billing/PricingPlans";
import { SubscriptionStatusBadge } from "@/components/billing/SubscriptionStatusBadge";
import { PaymentMethodCard } from "@/components/billing/PaymentMethodCard";
import type { Invoice, Subscription } from "@/lib/supabase/database.types";

const INVOICE_STYLE: Record<string, { color: string; background: string }> = {
  paid: { color: "var(--green)", background: "var(--green-weak)" },
  pending: { color: "var(--amber)", background: "var(--amber-weak)" },
  failed: { color: "var(--red)", background: "var(--red-weak)" },
};

interface Props {
  orgName: string;
  subscription: Subscription;
  invoices: Invoice[];
}

function ngn(n: number): string {
  return formatMoney(n, "NGN");
}

function daysUntil(iso: string): number {
  return Math.max(0, Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000));
}

export function BillingClient({ orgName, subscription, invoices }: Props) {
  const router = useRouter();
  const flash = useToast();
  const { formatLongDate } = useWorkspace();
  const [busy, setBusy] = useState<string | null>(null);

  const plan = planByKey(subscription.plan_key) ?? planByKey("monthly")!;
  const isGrandfathered = subscription.grandfathered;
  const isTrialing = subscription.status === "trialing";
  const isCancellable = ["trialing", "active", "past_due"].includes(subscription.status) && !subscription.cancel_at_period_end;
  const isReactivatable = ["cancelled", "expired", "suspended", "past_due"].includes(subscription.status) || subscription.cancel_at_period_end;

  async function handleChoosePlan(key: string) {
    setBusy(key);
    try {
      if (!subscription.authorization_code) {
        const { authorizationUrl } = await initiateAddCard(key as "monthly" | "yearly");
        window.location.href = authorizationUrl;
        return;
      }
      await changePlan(key as "monthly" | "yearly");
      flash(`Switched to the ${key} plan`);
      router.refresh();
    } catch (err) {
      flash(err instanceof Error ? err.message : "Could not change plan.");
    } finally {
      setBusy(null);
    }
  }

  async function handleAddOrUpdateCard() {
    setBusy("card");
    try {
      const planKey = subscription.plan_key === "yearly" ? "yearly" : "monthly";
      const { authorizationUrl } = await initiateAddCard(planKey);
      window.location.href = authorizationUrl;
    } catch (err) {
      flash(err instanceof Error ? err.message : "Could not start card setup.");
      setBusy(null);
    }
  }

  async function handleRemoveCard() {
    setBusy("card");
    try {
      await removePaymentMethod();
      flash("Payment method removed. You'll keep access until your current period ends.");
      router.refresh();
    } catch (err) {
      flash(err instanceof Error ? err.message : "Could not remove payment method.");
    } finally {
      setBusy(null);
    }
  }

  async function handleCancel() {
    setBusy("cancel");
    try {
      await cancelSubscription();
      flash("Subscription cancelled. You'll keep access until the current period ends.");
      router.refresh();
    } catch (err) {
      flash(err instanceof Error ? err.message : "Could not cancel subscription.");
    } finally {
      setBusy(null);
    }
  }

  async function handleReactivate() {
    setBusy("reactivate");
    try {
      await reactivateSubscription();
      flash("Subscription reactivated.");
      router.refresh();
    } catch (err) {
      flash(err instanceof Error ? err.message : "Could not reactivate subscription.");
    } finally {
      setBusy(null);
    }
  }

  async function downloadInvoice(inv: Invoice) {
    await exportInvoicePdf({
      orgName,
      invoiceNumber: inv.invoice_number,
      issuedAt: formatLongDate(inv.issued_at),
      status: inv.status,
      planLabel: planByKey(inv.plan_key ?? subscription.plan_key)?.name ?? inv.plan_key ?? subscription.plan_key,
      periodStart: inv.period_start ? formatLongDate(inv.period_start) : null,
      periodEnd: inv.period_end ? formatLongDate(inv.period_end) : null,
      paystackReference: inv.paystack_reference,
      amount: inv.amount,
      formatMoney: ngn,
    });
  }

  return (
    <div className="animate-fade-up">
      <div className="mb-[18px] flex items-center justify-between">
        <div>
          <div className="text-[22px] font-bold tracking-tight">Billing &amp; subscription</div>
          <div className="mt-[3px] text-text-2">Manage your plan, payment method, and billing history.</div>
        </div>
        <SubscriptionStatusBadge status={subscription.grandfathered ? "legacy" : subscription.status} />
      </div>

      {isGrandfathered ? (
        <div className="mb-[18px] rounded-2xl border border-border bg-surface p-5">
          <div className="text-[14px] font-bold">Grandfathered account</div>
          <div className="mt-1 text-[12.5px] text-text-2">
            Your workspace is on a legacy plan with no billing required. No card or payment is needed.
          </div>
        </div>
      ) : (
        <>
          <div
            className="mb-[18px] flex flex-wrap items-center justify-between gap-4.5 rounded-2xl p-[20px_22px] text-white shadow-[var(--shadow)]"
            style={{ background: "linear-gradient(135deg,var(--accent),#6366f1)" }}
          >
            <div>
              <div className="text-[12.5px] font-bold uppercase tracking-[0.05em] opacity-85">{plan.name} plan</div>
              <div className="mt-1 text-[26px] font-bold">
                {ngn(plan.price)}
                {plan.interval && <span className="text-[15px] font-semibold opacity-85">/{plan.interval === "monthly" ? "mo" : "yr"}</span>}
              </div>
              <div className="mt-1 text-[13px] opacity-90">
                {isTrialing && subscription.trial_ends_at ? (
                  <>Trial ends {formatLongDate(subscription.trial_ends_at)} · {daysUntil(subscription.trial_ends_at)} day(s) left</>
                ) : subscription.current_period_end ? (
                  <>Next billing date: {formatLongDate(subscription.current_period_end)}</>
                ) : (
                  "No active billing period"
                )}
                {subscription.cancel_at_period_end && " · Cancels at period end"}
              </div>
            </div>
            <div className="flex gap-2">
              {isCancellable && (
                <button
                  type="button"
                  disabled={busy !== null}
                  onClick={handleCancel}
                  className="h-[38px] rounded-[9px] border-none bg-white/15 px-4 text-[13px] font-semibold text-white hover:bg-white/25 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Cancel subscription
                </button>
              )}
              {isReactivatable && (
                <button
                  type="button"
                  disabled={busy !== null}
                  onClick={handleReactivate}
                  className="h-[38px] rounded-[9px] bg-white px-4 text-[13px] font-bold text-accent-2 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {busy === "reactivate" ? "Reactivating…" : "Reactivate"}
                </button>
              )}
            </div>
          </div>

          <div className="mb-[18px]">
            <div className="mb-2.5 text-[13px] font-bold text-text-2">Payment method</div>
            <PaymentMethodCard
              cardBrand={subscription.card_brand}
              cardLast4={subscription.card_last4}
              cardExpMonth={subscription.card_exp_month}
              cardExpYear={subscription.card_exp_year}
              busy={busy === "card"}
              onUpdate={handleAddOrUpdateCard}
              onRemove={handleRemoveCard}
            />
          </div>

          <PricingPlans
            plans={PLANS.filter((p) => p.selectable)}
            currentPlanKey={subscription.plan_key}
            busyKey={busy}
            onChoosePlan={handleChoosePlan}
            formatMoney={ngn}
          />
        </>
      )}

      <div className="overflow-hidden rounded-[14px] border border-border bg-surface shadow-[var(--shadow-sm)]">
        <div className="border-b border-border-2 px-4 py-3.5 text-[14px] font-bold">Billing history</div>
        {invoices.map((i) => (
          <div key={i.id} className="flex items-center gap-3.5 border-t border-border-2 px-4 py-3 hover:bg-hover">
            <span className="flex h-8 w-8 items-center justify-center rounded-[8px] bg-accent-weak text-[14px]">🧾</span>
            <div className="flex-1">
              <div className="font-mono text-[13px] font-semibold">{i.invoice_number}</div>
              <div className="text-[11.5px] text-muted">{formatLongDate(i.issued_at)}</div>
            </div>
            <span className="font-mono text-[13px] font-bold">{ngn(i.amount)}</span>
            <span
              className="rounded-[20px] px-[9px] py-0.5 text-[11.5px] font-bold capitalize"
              style={INVOICE_STYLE[i.status] ?? INVOICE_STYLE.pending}
            >
              {i.status}
            </span>
            <button onClick={() => downloadInvoice(i)} className="cursor-pointer text-[12.5px] font-semibold text-accent-text">
              Download
            </button>
          </div>
        ))}
        {invoices.length === 0 && <div className="px-4 py-6 text-center text-[13px] text-muted">No invoices yet.</div>}
      </div>
    </div>
  );
}
