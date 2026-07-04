"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { currencyForCountry, isKnownCountry } from "@/lib/geo/countries";
import { CURRENT_TERMS_VERSION } from "@/lib/terms";
import {
  validateFullName,
  validateEmail,
  validateBusinessEmail,
  validateBusinessName,
  validatePassword,
} from "@/lib/validation/auth";

const RATE_LIMIT_WINDOW_MINUTES = 15;
const RATE_LIMIT_MAX_ATTEMPTS = 5;

async function clientIp(): Promise<string> {
  const h = await headers();
  const forwarded = h.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return h.get("x-real-ip") ?? "unknown";
}

async function siteUrl(): Promise<string> {
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL;
  const h = await headers();
  const host = h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "https";
  return `${proto}://${host}`;
}

// Only the service-role admin client can read/write signup_attempts (RLS has
// no policies for anon/authenticated roles) — this can never be checked or
// tampered with from the browser.
async function checkAndRecordRateLimit(ip: string): Promise<boolean> {
  const admin = createAdminClient();
  const since = new Date(Date.now() - RATE_LIMIT_WINDOW_MINUTES * 60_000).toISOString();
  const { count } = await admin
    .from("signup_attempts")
    .select("id", { count: "exact", head: true })
    .eq("ip", ip)
    .gte("created_at", since);
  if ((count ?? 0) >= RATE_LIMIT_MAX_ATTEMPTS) return false;

  await admin.from("signup_attempts").insert({ ip });
  const pruneCutoff = new Date(Date.now() - 24 * 60 * 60_000).toISOString();
  await admin.from("signup_attempts").delete().eq("ip", ip).lt("created_at", pruneCutoff);
  return true;
}

export interface RegisterAccountInput {
  fullName: string;
  email: string;
  password: string;
  businessName: string;
  businessEmail?: string;
  country: string;
  state?: string;
  role: "admin" | "manager" | "staff";
  termsAccepted: boolean;
}

export type RegisterAccountResult = { ok: true; hasSession: boolean } | { ok: false; error: string };

export async function registerAccount(input: RegisterAccountInput): Promise<RegisterAccountResult> {
  const fullName = input.fullName.trim();
  const email = input.email.trim().toLowerCase();
  const businessName = input.businessName.trim();
  const businessEmail = input.businessEmail?.trim() || undefined;
  const country = input.country.trim();
  const state = input.state?.trim() || undefined;

  const fieldError =
    validateFullName(fullName) ||
    validateEmail(email) ||
    validateBusinessName(businessName) ||
    validateBusinessEmail(businessEmail ?? "") ||
    validatePassword(input.password);
  if (fieldError) return { ok: false, error: fieldError };
  if (!isKnownCountry(country)) return { ok: false, error: "Select a valid country." };
  if (!input.termsAccepted) {
    return { ok: false, error: "You must accept the Terms & Conditions and Privacy Policy." };
  }

  const ip = await clientIp();
  const allowed = await checkAndRecordRateLimit(ip);
  if (!allowed) {
    return { ok: false, error: "Too many signup attempts from this network. Please try again in a few minutes." };
  }

  const [firstName, ...rest] = fullName.split(/\s+/);
  const lastName = rest.join(" ") || undefined;
  const currency = currencyForCountry(country) ?? "USD";

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password: input.password,
    options: {
      data: {
        first_name: firstName,
        last_name: lastName,
        business_name: businessName,
        business_email: businessEmail,
        country,
        state,
        currency,
        role: input.role,
        terms_accepted: true,
        terms_version: CURRENT_TERMS_VERSION,
        terms_accepted_ip: ip,
      },
      emailRedirectTo: `${await siteUrl()}/mfa-setup`,
    },
  });

  if (error) return { ok: false, error: error.message };
  return { ok: true, hasSession: !!data.session };
}

export interface CompleteOnboardingInput {
  businessName?: string;
  businessEmail?: string;
  country?: string;
  state?: string;
  termsAccepted?: boolean;
}

// Fills in gaps left by OAuth signup or pre-migration accounts. Business
// fields are only writable by owner/admin (mirrors the is_org_admin() RLS
// already on `organizations`) so a lower-privilege teammate landing here
// can't use it to rename/redirect the business — they can still accept
// terms for themselves.
export async function completeOnboarding(input: CompleteOnboardingInput) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data: profile } = await supabase
    .from("profiles")
    .select("org_id, role, terms_accepted")
    .eq("id", user.id)
    .single();
  if (!profile) throw new Error("No profile");

  const isAdmin = profile.role === "owner" || profile.role === "admin";
  const wantsOrgUpdate = input.businessName || input.businessEmail || input.country || input.state;

  if (wantsOrgUpdate) {
    if (!isAdmin) throw new Error("Only an owner or admin can complete the business profile.");
    if (input.country && !isKnownCountry(input.country)) throw new Error("Select a valid country.");

    const patch: Record<string, string> = {};
    if (input.businessName?.trim()) patch.name = input.businessName.trim();
    if (input.businessEmail?.trim()) patch.business_email = input.businessEmail.trim();
    if (input.country) {
      patch.country = input.country;
      patch.currency = currencyForCountry(input.country) ?? "USD";
    }
    if (input.state?.trim()) patch.state = input.state.trim();

    const { error } = await supabase.from("organizations").update(patch).eq("id", profile.org_id);
    if (error) throw error;
  }

  if (input.termsAccepted && !profile.terms_accepted) {
    const ip = await clientIp();
    const { error } = await supabase
      .from("profiles")
      .update({
        terms_accepted: true,
        terms_version: CURRENT_TERMS_VERSION,
        terms_accepted_at: new Date().toISOString(),
        terms_accepted_ip: ip,
      })
      .eq("id", user.id);
    if (error) throw error;
  }

  revalidatePath("/onboarding/complete");
  revalidatePath("/dashboard");
}

export async function acceptInviteTerms() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const ip = await clientIp();
  const { error } = await supabase
    .from("profiles")
    .update({
      terms_accepted: true,
      terms_version: CURRENT_TERMS_VERSION,
      terms_accepted_at: new Date().toISOString(),
      terms_accepted_ip: ip,
    })
    .eq("id", user.id);
  if (error) throw error;
}
