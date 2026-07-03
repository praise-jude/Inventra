"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Field } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("ava@freshmart.co");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const supabase = createClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    if (signInError) {
      setError(signInError.message);
      setLoading(false);
      return;
    }

    const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (aal && aal.currentLevel !== aal.nextLevel) {
      router.push("/mfa-challenge");
      return;
    }
    const { data: factors } = await supabase.auth.mfa.listFactors();
    const hasVerifiedFactor = (factors?.totp ?? []).some((f) => f.status === "verified");
    router.push(hasVerifiedFactor ? "/dashboard" : "/mfa-setup");
  }

  return (
    <div>
      <h1 className="mb-1.5 text-2xl font-bold tracking-tight">Welcome back</h1>
      <p className="mb-[26px] text-text-2">Sign in to your workspace to continue.</p>
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
          <Field
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
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
        <Button type="button" variant="secondary" disabled className="w-full" title="Coming soon">
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
