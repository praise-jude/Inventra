import "server-only";
import crypto from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { planByKey } from "@/lib/billing-plans";
import { siteUrl } from "@/lib/site-url";
import { createCustomer, initializeTransaction } from "@/lib/paystack";
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
