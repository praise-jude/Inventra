"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { acceptInviteTerms, activateInviteAccount } from "@/lib/actions/auth";
import { notifyPendingApproval } from "@/lib/actions/notifications";
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
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!termsAccepted) {
      setError("You must accept the Terms & Conditions and Privacy Policy.");
      return;
    }
    setLoading(true);

    const result = await activateInviteAccount(password);
    if (!result.ok) {
      setError(result.error ?? "Could not set your password.");
      setLoading(false);
      return;
    }

    const supabase = createClient();
    const { data: userData } = await supabase.auth.getUser();

    try {
      if (userData.user) {
        // Lands in awaiting_approval, or straight to active if invited by
        // an Owner/Admin — guard_profile_status_transitions() computes the
        // real target status server-side, this write is just the trigger.
        // notifyPendingApproval() checks what actually landed rather than
        // assuming this write took effect verbatim.
        await supabase.from("profiles").update({ status: "awaiting_approval" }).eq("id", userData.user.id);
        await acceptInviteTerms();
        void notifyPendingApproval();
      }
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
        <Field
          label="Password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          minLength={8}
          required
        />
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
