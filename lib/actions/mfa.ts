"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { generateRecoveryCodes, hashRecoveryCode, verifyRecoveryCodeHash } from "@/lib/mfa";
import { sendMfaEnabledEmail, sendMfaDisabledEmail, sendRecoveryCodeUsedEmail } from "@/lib/email";

const RECOVERY_RATE_LIMIT_WINDOW_MINUTES = 15;
const RECOVERY_RATE_LIMIT_MAX_ATTEMPTS = 5;

// Mirrors checkAndRecordRateLimit in lib/actions/auth.ts, keyed by user_id
// instead of IP — recovery-code verification only ever happens post-
// password-login, so we already know who's attempting.
async function checkAndRecordRecoveryAttempt(userId: string): Promise<boolean> {
  const admin = createAdminClient();
  const since = new Date(Date.now() - RECOVERY_RATE_LIMIT_WINDOW_MINUTES * 60_000).toISOString();
  const { count } = await admin
    .from("mfa_recovery_attempts")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .gte("created_at", since);
  if ((count ?? 0) >= RECOVERY_RATE_LIMIT_MAX_ATTEMPTS) return false;

  await admin.from("mfa_recovery_attempts").insert({ user_id: userId });
  return true;
}

// Called right after a successful enrollment verify (mfa.verify). Replaces
// any previous set — regenerating invalidates old codes, same as most
// providers' "regenerate backup codes" behavior. Plaintext codes are
// returned exactly once; only the hash is ever persisted.
export async function generateAndStoreRecoveryCodes(): Promise<string[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const codes = generateRecoveryCodes(10);
  const admin = createAdminClient();
  await admin.from("mfa_recovery_codes").delete().eq("user_id", user.id);
  await admin.from("mfa_recovery_codes").insert(codes.map((code) => ({ user_id: user.id, code_hash: hashRecoveryCode(code) })));

  if (user.email) {
    void sendMfaEnabledEmail({ to: user.email }).catch(() => {});
  }

  return codes;
}

// Used both at login-time (step-up challenge, "lost your authenticator?")
// and as one of the two accepted proofs when disabling MFA. Consumes the
// code on success — recovery codes are always single-use.
export async function verifyRecoveryCode(code: string): Promise<boolean> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const allowed = await checkAndRecordRecoveryAttempt(user.id);
  if (!allowed) throw new Error("Too many attempts. Please wait a few minutes and try again.");

  const admin = createAdminClient();
  const { data: candidates } = await admin
    .from("mfa_recovery_codes")
    .select("id, code_hash")
    .eq("user_id", user.id)
    .eq("used", false);

  const match = (candidates ?? []).find((c) => verifyRecoveryCodeHash(code, c.code_hash));
  if (!match) return false;

  await admin.from("mfa_recovery_codes").update({ used: true, used_at: new Date().toISOString() }).eq("id", match.id);

  if (user.email) {
    void sendRecoveryCodeUsedEmail({ to: user.email }).catch(() => {});
  }

  return true;
}

export async function getRecoveryCodeCount(): Promise<number> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return 0;

    const { count, error } = await supabase
      .from("mfa_recovery_codes")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("used", false);
    if (error) console.error("[Inventra] getRecoveryCodeCount failed:", error);
    return count ?? 0;
  } catch (err) {
    console.error("[Inventra] getRecoveryCodeCount threw:", err);
    return 0;
  }
}

// Disabling requires the password PLUS a second factor (TOTP code OR a
// recovery code) — never password alone. The actual unenroll is done via
// the Admin API (not the user's own session) because Supabase requires a
// real AAL2 session for self-service unenroll, which a recovery-code-only
// login can never produce (see AGENTS notes / conversation: this is what
// lets someone who lost their authenticator still turn MFA off, instead of
// needing manual admin intervention every time).
export async function disableMfaWithPassword(input: { password: string; code: string }): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) throw new Error("Not authenticated");

  const { error: pwError } = await supabase.auth.signInWithPassword({ email: user.email, password: input.password });
  if (pwError) throw new Error("Incorrect password.");

  const { data: factors } = await supabase.auth.mfa.listFactors();
  const totpFactor = factors?.totp?.[0];
  if (!totpFactor) throw new Error("MFA is not enabled.");

  let verified = false;
  const code = input.code.trim();
  if (/^\d{6}$/.test(code)) {
    const challenge = await supabase.auth.mfa.challenge({ factorId: totpFactor.id });
    if (!challenge.error) {
      const verify = await supabase.auth.mfa.verify({ factorId: totpFactor.id, challengeId: challenge.data.id, code });
      verified = !verify.error;
    }
  }
  if (!verified) {
    verified = await verifyRecoveryCode(code);
  }
  if (!verified) throw new Error("Invalid authentication code.");

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const res = await fetch(`${supabaseUrl}/auth/v1/admin/users/${user.id}/factors/${totpFactor.id}`, {
    method: "DELETE",
    headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` },
  });
  if (!res.ok) throw new Error("Could not disable MFA. Please try again.");

  const admin = createAdminClient();
  await admin.from("mfa_recovery_codes").delete().eq("user_id", user.id);

  void sendMfaDisabledEmail({ to: user.email }).catch(() => {});
}
