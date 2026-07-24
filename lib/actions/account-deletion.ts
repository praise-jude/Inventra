"use server";

import { headers } from "next/headers";
import { checkAndRecordRateLimit } from "@/lib/rate-limit";
import { validateEmail } from "@/lib/validation/auth";
import { sendAccountDeletionRequestEmail, sendAccountDeletionAckEmail } from "@/lib/email";

// Same clientIp() pattern as lib/actions/auth.ts's login/password-reset rate
// limits — this form is reachable by anyone, logged in or not (Google Play
// requires the deletion-request link to work without needing app access),
// so it needs the same anti-abuse treatment as signup.
async function clientIp(): Promise<string> {
  const h = await headers();
  const forwarded = h.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return h.get("x-real-ip") ?? "unknown";
}

export interface RequestAccountDeletionResult {
  ok: boolean;
  error?: string;
}

export async function requestAccountDeletion(formData: FormData): Promise<RequestAccountDeletionResult> {
  const email = String(formData.get("email") ?? "").trim();
  const businessName = String(formData.get("businessName") ?? "").trim();
  const details = String(formData.get("details") ?? "").trim();

  const emailError = validateEmail(email);
  if (emailError) return { ok: false, error: emailError };

  const ip = await clientIp();
  const allowed = await checkAndRecordRateLimit("account-deletion", ip);
  if (!allowed) {
    return { ok: false, error: "Too many requests from this network. Please try again later, or email privacy@royalinventra.com.ng directly." };
  }

  await sendAccountDeletionRequestEmail({ requesterEmail: email, businessName, details });
  await sendAccountDeletionAckEmail({ to: email });

  return { ok: true };
}
