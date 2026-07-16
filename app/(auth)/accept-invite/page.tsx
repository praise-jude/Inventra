"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { acceptInviteTerms } from "@/lib/actions/auth";
import { Field } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";

export default function AcceptInvitePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const linkExpired = searchParams.get("error") === "expired";
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
    const supabase = createClient();

    const { data: userData, error: updateError } = await supabase.auth.updateUser({ password });
    if (updateError) {
      setError(updateError.message);
      setLoading(false);
      return;
    }

    try {
      if (userData.user) {
        // Lands in awaiting_approval, not active — an admin must approve
        // before this account can use the app (see requireProfile()).
        await supabase.from("profiles").update({ status: "awaiting_approval" }).eq("id", userData.user.id);
        await acceptInviteTerms();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not finish activating your account. Please try signing in — if that fails, ask an admin to resend your invite.");
      setLoading(false);
      return;
    }

    setLoading(false);
    router.push("/pending-approval");
  }

  if (linkExpired) {
    return (
      <div>
        <h1 className="mb-1.5 text-2xl font-bold tracking-tight">This invite link has expired</h1>
        <p className="text-text-2">Ask an admin to resend your invitation from Team settings, then use the new link from that email.</p>
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
      <h1 className="mb-1.5 text-2xl font-bold tracking-tight">Join your team</h1>
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
