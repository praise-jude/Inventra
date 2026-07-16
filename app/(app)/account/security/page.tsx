import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/queries/session";
import { getRecoveryCodeCount } from "@/lib/actions/mfa";
import { SecurityClient } from "@/components/account/SecurityClient";

// Deliberately NOT under /settings (requireAdminProfile-gated) — MFA
// secures an individual's own login, so every role (cashier, warehouse,
// not just owner/admin) needs to be able to reach this page.
export default async function AccountSecurityPage() {
  await requireProfile();
  const supabase = await createClient();
  const { data: factors } = await supabase.auth.mfa.listFactors();
  const totpFactor = factors?.totp?.[0] ?? null;
  const recoveryCodeCount = totpFactor ? await getRecoveryCodeCount() : 0;

  return <SecurityClient mfaEnabled={!!totpFactor} recoveryCodeCount={recoveryCodeCount} />;
}
