"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Eye, EyeOff } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { acceptInviteTerms, activateInviteAccount } from "@/lib/actions/auth";
import { notifyPendingApproval } from "@/lib/actions/notifications";
import { PASSWORD_RULES, passwordStrength } from "@/lib/validation/auth";
import { Field } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";

// Restored for Branch Staff (lib/branch-staff-service.ts) — the invite
// trigger/status-transition machinery this depends on
// (guard_profile_status_transitions(), activateInviteAccount,
// acceptInviteTerms) was never removed when Team Management's UI was, only
// this page was. useSearchParams() requires a Suspense boundary — without
// one, this page can't be statically prerendered at all.
export default function AcceptInvitePage() {
  return (
    <Suspense fallback={null}>
      <AcceptInviteForm />
    </Suspense>
  );
}

function AcceptInviteForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  // "expired" is our own legacy query param (no longer set — kept for
  // safety); a real invite link now redirects here straight from
  // Supabase, whose verify endpoint reports failures as
  // ?error=access_denied&error_code=otp_expired&error_description=... in
  // the query string (errors are query params even though a *successful*
  // verification's tokens arrive in the URL hash instead).
  const linkExpired = searchParams.get("error") === "expired" || searchParams.has("error_code");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const strength = passwordStrength(password);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!termsAccepted) {
      setError("You must accept the Terms & Conditions and Privacy Policy.");
      return;
    }
    setLoading(true);

    const supabase = createClient();
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      setError("Your session has expired. Please open the invite link from your email again.");
      setLoading(false);
      return;
    }

    // Guards against whoever happens to already be signed in landing here
    // (e.g. an owner who was still logged in from another tab, or a stale
    // bookmark) and having THEIR account's password changed and status
    // flipped to awaiting_approval — this previously had no check at all,
    // so it silently mutated whatever account the browser's current
    // session belonged to, invite or not.
    const { data: profile } = await supabase.from("profiles").select("status").eq("id", userData.user.id).single();
    if (profile?.status !== "invited") {
      setError(
        "This invite link doesn't match your currently signed-in account. If you're accepting a different invite, sign out first and open the link from that invite email.",
      );
      setLoading(false);
      return;
    }

    const result = await activateInviteAccount(password);
    if (!result.ok) {
      setError(result.error ?? "Could not set your password.");
      setLoading(false);
      return;
    }

    try {
      // Lands in awaiting_approval, or straight to active if invited by
      // an Owner/Admin — guard_profile_status_transitions() computes the
      // real target status server-side, this write is just the trigger.
      // notifyPendingApproval() checks what actually landed rather than
      // assuming this write took effect verbatim.
      await supabase.from("profiles").update({ status: "awaiting_approval" }).eq("id", userData.user.id);
      await acceptInviteTerms();
      void notifyPendingApproval();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not finish activating your account. Please try signing in — if that fails, ask your branch manager to resend your invite.");
      setLoading(false);
      return;
    }

    setLoading(false);
    router.push("/pending-approval");
  }

  if (linkExpired) {
    return (
      <div>
        <h1 className="mb-1.5 text-2xl font-bold tracking-tight">This invite link isn&apos;t valid</h1>
        <p className="text-text-2">
          It may have expired or already been used — invite links only work once. Ask your branch manager or an admin
          to resend your invitation from Branch Staff, then use the new link from that email.
        </p>
        <p className="mt-6 text-center text-[13.5px] text-text-2">
          <Link href="/login" className="font-semibold text-accent-text">
            ← Back to sign in
          </Link>
        </p>
      </div>
    );
  }

  return (
    <div>
      <h1 className="mb-1.5 text-2xl font-bold tracking-tight">Join your branch</h1>
      <p className="mb-[26px] text-text-2">Set a password to activate your Inventra account.</p>
      <form onSubmit={handleSubmit} className="flex flex-col gap-3.5">
        <div>
          <div className="relative">
            <Field
              label="Password"
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="pr-12"
              required
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? "Hide password" : "Show password"}
              className="absolute right-3 top-[30px] text-text-2 hover:text-text"
            >
              {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
            </button>
          </div>
          <div className="mt-2 flex gap-[5px]">
            {[0, 1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="h-1 flex-1 rounded-[3px]"
                style={{ background: i < strength ? (strength >= 4 ? "var(--green)" : "var(--amber)") : "var(--border)" }}
              />
            ))}
          </div>
          <ul className="mt-2 flex flex-col gap-0.5">
            {PASSWORD_RULES.map((rule) => (
              <li key={rule.key} className="text-[11.5px]" style={{ color: rule.test(password) ? "var(--green)" : "var(--muted)" }}>
                {rule.test(password) ? "✓" : "○"} {rule.label}
              </li>
            ))}
          </ul>
        </div>
        <label className="flex items-start gap-2 text-[12.5px] text-text-2">
          <input
            type="checkbox"
            checked={termsAccepted}
            onChange={(e) => setTermsAccepted(e.target.checked)}
            className="mt-0.5"
          />
          <span>
            I agree to the{" "}
            <Link href="/terms" className="font-semibold text-accent-text">
              Terms &amp; Conditions
            </Link>{" "}
            and{" "}
            <Link href="/privacy" className="font-semibold text-accent-text">
              Privacy Policy
            </Link>
            .
          </span>
        </label>
        {error && <p className="text-[13px] font-medium text-red">{error}</p>}
        <Button type="submit" disabled={loading} className="w-full">
          {loading ? "Setting up…" : "Activate account"}
        </Button>
      </form>
    </div>
  );
}
