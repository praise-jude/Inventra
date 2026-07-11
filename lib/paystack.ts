import "server-only";
import crypto from "node:crypto";

const BASE_URL = "https://api.paystack.co";

// Paystack signs webhook deliveries with HMAC-SHA512 of the raw request
// body, keyed with the secret key — the body must be read as raw text
// (never JSON.parse'd first) or the signature won't match. Client-side
// payment responses are never trusted; this signature is the only thing
// that authorizes a webhook handler to change subscription state.
export function verifyWebhookSignature(rawBody: string, signatureHeader: string | null): boolean {
  const secretKey = process.env.PAYSTACK_SECRET_KEY;
  if (!secretKey || !signatureHeader) return false;
  const expected = crypto.createHmac("sha512", secretKey).update(rawBody).digest("hex");
  const expectedBuf = Buffer.from(expected, "hex");
  const actualBuf = Buffer.from(signatureHeader, "hex");
  if (expectedBuf.length !== actualBuf.length) return false;
  return crypto.timingSafeEqual(expectedBuf, actualBuf);
}

export class PaystackError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly body: unknown,
  ) {
    super(message);
    this.name = "PaystackError";
  }
}

// Paystack amounts are always the smallest currency unit — kobo for NGN.
export function toKobo(naira: number): number {
  return Math.round(naira * 100);
}

async function paystackFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const secretKey = process.env.PAYSTACK_SECRET_KEY;
  if (!secretKey) throw new Error("PAYSTACK_SECRET_KEY is not configured.");

  const res = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${secretKey}`,
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });
  const body = await res.json().catch(() => null);
  if (!res.ok || body?.status === false) {
    throw new PaystackError(body?.message ?? `Paystack request failed (${res.status})`, res.status, body);
  }
  return body as T;
}

export interface PaystackCustomer {
  id: number;
  customer_code: string;
  email: string;
}

export async function createCustomer(input: {
  email: string;
  firstName?: string;
  lastName?: string;
  orgId: string;
}): Promise<PaystackCustomer> {
  const { data } = await paystackFetch<{ data: PaystackCustomer }>("/customer", {
    method: "POST",
    body: JSON.stringify({
      email: input.email,
      first_name: input.firstName,
      last_name: input.lastName,
      metadata: { org_id: input.orgId },
    }),
  });
  return data;
}

export interface InitializeTransactionResult {
  authorization_url: string;
  access_code: string;
  reference: string;
}

// Used both for the ₦50 card-verification charge (refunded once tokenized)
// and for a manual reactivation charge when a subscription needs a fresh
// authorization. Amount is in naira; converted to kobo internally.
export async function initializeTransaction(input: {
  email: string;
  amountNaira: number;
  reference: string;
  callbackUrl: string;
  metadata: Record<string, unknown>;
}): Promise<InitializeTransactionResult> {
  const { data } = await paystackFetch<{ data: InitializeTransactionResult }>("/transaction/initialize", {
    method: "POST",
    body: JSON.stringify({
      email: input.email,
      amount: toKobo(input.amountNaira),
      currency: "NGN",
      reference: input.reference,
      callback_url: input.callbackUrl,
      metadata: input.metadata,
    }),
  });
  return data;
}

export interface PaystackAuthorization {
  authorization_code: string;
  bin: string;
  last4: string;
  exp_month: string;
  exp_year: string;
  card_type: string;
  bank: string;
  reusable: boolean;
}

export interface VerifyTransactionResult {
  status: "success" | "failed" | "abandoned" | "pending" | string;
  reference: string;
  amount: number;
  currency: string;
  customer: { customer_code: string; email: string };
  authorization: PaystackAuthorization;
  metadata: Record<string, unknown> | null;
}

export async function verifyTransaction(reference: string): Promise<VerifyTransactionResult> {
  const { data } = await paystackFetch<{ data: VerifyTransactionResult }>(
    `/transaction/verify/${encodeURIComponent(reference)}`,
  );
  return data;
}

export async function refundTransaction(reference: string): Promise<void> {
  await paystackFetch("/refund", {
    method: "POST",
    body: JSON.stringify({ transaction: reference }),
  });
}

export interface ChargeAuthorizationResult {
  status: "success" | "failed" | "send_otp" | string;
  reference: string;
  gateway_response: string;
  amount: number;
}

// Recurring/renewal charge and reactivation-after-cancel — same authorization
// code the customer tokenized once via the hosted checkout, no card data ever
// re-collected. A "send_otp" (or any non-"success") result is treated as a
// failure for dunning purposes: there's no customer present to enter an OTP
// during an unattended recurring charge.
export async function chargeAuthorization(input: {
  authorizationCode: string;
  email: string;
  amountNaira: number;
  reference: string;
  metadata: Record<string, unknown>;
}): Promise<ChargeAuthorizationResult> {
  const { data } = await paystackFetch<{ data: ChargeAuthorizationResult }>("/transaction/charge_authorization", {
    method: "POST",
    body: JSON.stringify({
      authorization_code: input.authorizationCode,
      email: input.email,
      amount: toKobo(input.amountNaira),
      currency: "NGN",
      reference: input.reference,
      metadata: input.metadata,
    }),
  });
  return data;
}

export interface PaystackSubscription {
  subscription_code: string;
  email_token: string;
  status: string;
}

export async function createSubscription(input: {
  customerCode: string;
  planCode: string;
  authorizationCode: string;
  startDate: Date;
}): Promise<PaystackSubscription> {
  const { data } = await paystackFetch<{ data: PaystackSubscription }>("/subscription", {
    method: "POST",
    body: JSON.stringify({
      customer: input.customerCode,
      plan: input.planCode,
      authorization: input.authorizationCode,
      start_date: input.startDate.toISOString(),
    }),
  });
  return data;
}

export async function disableSubscription(input: { code: string; token: string }): Promise<void> {
  await paystackFetch("/subscription/disable", {
    method: "POST",
    body: JSON.stringify({ code: input.code, token: input.token }),
  });
}

export async function enableSubscription(input: { code: string; token: string }): Promise<void> {
  await paystackFetch("/subscription/enable", {
    method: "POST",
    body: JSON.stringify({ code: input.code, token: input.token }),
  });
}

export interface FetchSubscriptionResult {
  status: string;
  next_payment_date: string | null;
  subscription_code: string;
}

export async function fetchSubscription(code: string): Promise<FetchSubscriptionResult> {
  const { data } = await paystackFetch<{ data: FetchSubscriptionResult }>(`/subscription/${encodeURIComponent(code)}`);
  return data;
}

export interface PaystackPlan {
  plan_code: string;
  name: string;
}

// One-off, called manually (not from app code) to create the two plans —
// documented here so the resulting PLN_xxx codes have a clear origin for
// whoever sets PAYSTACK_PLAN_CODE_MONTHLY/PAYSTACK_PLAN_CODE_YEARLY.
export async function createPlan(input: {
  name: string;
  amountNaira: number;
  interval: "monthly" | "annually";
}): Promise<PaystackPlan> {
  const { data } = await paystackFetch<{ data: PaystackPlan }>("/plan", {
    method: "POST",
    body: JSON.stringify({
      name: input.name,
      amount: toKobo(input.amountNaira),
      interval: input.interval,
      currency: "NGN",
    }),
  });
  return data;
}
