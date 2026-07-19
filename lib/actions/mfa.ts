"use server";

import { createClient } from "@/lib/supabase/server";
import {
  generateAndStoreRecoveryCodesForContext,
  verifyRecoveryCodeForContext,
  getRecoveryCodeCountForContext,
  disableMfaWithPasswordForContext,
} from "@/lib/mfa-service";

export async function generateAndStoreRecoveryCodes(): Promise<string[]> {
  const supabase = await createClient();
  return generateAndStoreRecoveryCodesForContext(supabase);
}

export async function verifyRecoveryCode(code: string): Promise<boolean> {
  const supabase = await createClient();
  return verifyRecoveryCodeForContext(supabase, code);
}

export async function getRecoveryCodeCount(): Promise<number> {
  const supabase = await createClient();
  return getRecoveryCodeCountForContext(supabase);
}

export async function disableMfaWithPassword(input: { password: string; code: string }): Promise<void> {
  const supabase = await createClient();
  return disableMfaWithPasswordForContext(supabase, input);
}
