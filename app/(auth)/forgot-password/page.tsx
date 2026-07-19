"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { checkPasswordResetRateLimit } from "@/lib/actions/auth";
import { Field } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const rateLimit = await checkPasswordResetRateLimit();
    if (!rateLimit.ok) {
      setError(rateLimit.error ?? "Too many attempts. Please try again in a few minutes.");
      setLoading(false);
      return;
    }
    const supabase = createClient();
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback?next=/reset-password`,
    });
    setLoading(false);
    if (resetError) {
      setError(resetError.message);
      return;
    }
    setSent(true);
  }

  if (sent) {
    return (
      <div>
        <h1 className="mb-1.5 text-2xl font-bold tracking-tight">Check your email</h1>
        <p className="text-text-2">
          If an account exists for <b className="text-text">{email}</b>, a reset link is on its
          way.
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
      <h1 className="mb-1.5 text-2xl font-bold tracking-tight">Reset password</h1>
      <p className="mb-[26px] text-text-2">Enter your email and we&apos;ll send a reset link.</p>
      <form onSubmit={handleSubmit} className="flex flex-col gap-3.5">
        <Field
          label="Email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        {error && <p className="text-[13px] font-medium text-red">{error}</p>}
        <Button type="submit" disabled={loading} className="w-full">
          {loading ? "Sending…" : "Send reset link"}
        </Button>
      </form>
      <p className="mt-6 text-center text-[13.5px] text-text-2">
        <Link href="/login" className="font-semibold text-accent-text">
          ← Back to sign in
        </Link>
      </p>
    </div>
  );
}
