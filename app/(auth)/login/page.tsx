"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Eye, EyeOff } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { recordLogin } from "@/lib/actions/audit";
import { verifyRecoveryCode } from "@/lib/actions/mfa";
import { friendlyAuthErrorMessage, withAuthRetry } from "@/lib/network-retry";
import { Field } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const suspended = searchParams.get("suspended") === "1";
  const rejected = searchParams.get("rejected") === "1";
  const [email, setEmail] = useState("ava@freshmart.co");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Set once password auth succeeds but a second factor is still required
  // (getAuthenticatorAssuranceLevel().nextLevel === "aal2") — the user
  // already has a valid AAL1 session at this point, they just can't reach
  // protected pages until they step up. Also seeded from ?mfa=1, which
  // middleware sets when it bounces an AAL1-only session back here —
  // needed for Google OAuth, whose full-page redirect round trip remounts
  // this component fresh and would otherwise lose the step-up prompt.
  const [needsMfa, setNeedsMfa] = useState(searchParams.get("mfa") === "1");
  const [useRecoveryCode, setUseRecoveryCode] = useState(false);
  const [mfaCode, setMfaCode] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const supabase = createClient();
    const { error: signInError } = await withAuthRetry(() => supabase.auth.signInWithPassword({ email, password }));
    if (signInError) {
      setError(friendlyAuthErrorMessage(signInError.message));
      setLoading(false);
      return;
    }

    const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (aal && aal.nextLevel === "aal2" && aal.nextLevel !== aal.currentLevel) {
      setNeedsMfa(true);
      setLoading(false);
      return;
    }

    finishLogin();
  }

  function finishLogin() {
    // Navigate first: recordLogin() is a server action that POSTs to
    // whatever page it's called from, and middleware redirects an
    // authenticated request for /login straight to /dashboard — calling
    // it before router.push made that redirect collide with the action's
    // own response, surfacing as "unexpected response from server".
    router.push("/dashboard");
    void recordLogin();
  }

  async function handleMfaSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      if (useRecoveryCode) {
        const ok = await verifyRecoveryCode(mfaCode.trim());
        if (!ok) throw new Error("Invalid recovery code.");
        finishLogin();
        return;
      }

      const supabase = createClient();
      const { data: factors, error: factorsError } = await supabase.auth.mfa.listFactors();
      if (factorsError) throw factorsError;
      const totpFactor = factors?.totp?.[0];
      if (!totpFactor) throw new Error("No authenticator found on this account.");

      const challenge = await supabase.auth.mfa.challenge({ factorId: totpFactor.id });
      if (challenge.error) throw challenge.error;
      const verify = await supabase.auth.mfa.verify({
        factorId: totpFactor.id,
        challengeId: challenge.data.id,
        code: mfaCode.trim(),
      });
      if (verify.error) throw verify.error;

      finishLogin();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Invalid authentication code.");
      setLoading(false);
    }
  }

  async function handleGoogle() {
    setError(null);
    const supabase = createClient();
    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
    // On success this redirects the whole page to Google's consent screen —
    // execution only reaches here when the request never sent the browser
    // anywhere, e.g. the provider isn't enabled in Supabase yet.
    if (oauthError) setError(oauthError.message);
  }

  if (needsMfa) {
    return (
      <div>
        <h1 className="mb-1.5 text-2xl font-bold tracking-tight">Enter authentication code</h1>
        <p className="mb-[26px] text-text-2">
          {useRecoveryCode
            ? "Enter one of your recovery codes."
            : "Enter the 6-digit code from your authenticator app."}
        </p>
        <form onSubmit={handleMfaSubmit} className="flex flex-col gap-3.5">
          <Field
            value={mfaCode}
            onChange={(e) => setMfaCode(e.target.value.trim())}
            placeholder={useRecoveryCode ? "HDT4-9XPA" : "123456"}
            inputMode={useRecoveryCode ? "text" : "numeric"}
            autoFocus
            required
          />
          {error && <p className="text-[13px] font-medium text-red">{error}</p>}
          <Button type="submit" disabled={loading} className="w-full">
            {loading ? "Verifying…" : "Verify"}
          </Button>
        </form>
        <p className="mt-6 text-center text-[13.5px] text-text-2">
          <button
            type="button"
            onClick={() => {
              setError(null);
              setMfaCode("");
              setUseRecoveryCode((v) => !v);
            }}
            className="font-semibold text-accent-text"
          >
            {useRecoveryCode ? "Use authenticator app instead" : "Lost your authenticator? Use a recovery code"}
          </button>
        </p>
      </div>
    );
  }

  return (
    <div>
      <h1 className="mb-1.5 text-2xl font-bold tracking-tight">Welcome back</h1>
      <p className="mb-[26px] text-text-2">Sign in to your workspace to continue.</p>
      {suspended && (
        <p className="mb-3.5 rounded-[9px] border border-red bg-red-weak px-3.5 py-2.5 text-[13px] font-medium text-red">
          Your account has been suspended. Contact your workspace admin for access.
        </p>
      )}
      {rejected && (
        <p className="mb-3.5 rounded-[9px] border border-red bg-red-weak px-3.5 py-2.5 text-[13px] font-medium text-red">
          Your access request was declined. Contact your workspace admin, or ask for a new invitation.
        </p>
      )}
      <form onSubmit={handleSubmit} className="flex flex-col gap-3.5">
        <Field
          label="Email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <label className="text-[12.5px] font-semibold text-text-2">Password</label>
            <Link href="/forgot-password" className="text-[12.5px] font-semibold text-accent-text">
              Forgot?
            </Link>
          </div>
          <div className="relative">
            <Field
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="pr-11"
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? "Hide password" : "Show password"}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-text-2 hover:text-text"
            >
              {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
            </button>
          </div>
        </div>
        {error && <p className="text-[13px] font-medium text-red">{error}</p>}
        <Button type="submit" disabled={loading} className="w-full">
          {loading ? "Signing in…" : "Sign in →"}
        </Button>
        <div className="my-1 flex items-center gap-3 text-xs text-faint">
          <div className="h-px flex-1 bg-border" />
          OR
          <div className="h-px flex-1 bg-border" />
        </div>
        <Button type="button" variant="secondary" onClick={handleGoogle} className="w-full">
          <span className="font-extrabold text-[#4285F4]">G</span> Continue with Google
        </Button>
      </form>
      <p className="mt-6 text-center text-[13.5px] text-text-2">
        No account?{" "}
        <Link href="/signup" className="font-semibold text-accent-text">
          Create one
        </Link>
      </p>
    </div>
  );
}
