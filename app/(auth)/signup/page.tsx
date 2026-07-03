"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Field } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";

function passwordStrength(pw: string) {
  let score = 0;
  if (pw.length >= 8) score++;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) score++;
  if (/\d/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  return score;
}

export default function SignupPage() {
  const router = useRouter();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [awaitingConfirmation, setAwaitingConfirmation] = useState(false);
  const strength = passwordStrength(password);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const supabase = createClient();
    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { first_name: firstName, last_name: lastName },
        emailRedirectTo: `${window.location.origin}/mfa-setup`,
      },
    });
    setLoading(false);
    if (signUpError) {
      setError(signUpError.message);
      return;
    }
    if (data.session) {
      router.push("/mfa-setup");
      return;
    }
    setAwaitingConfirmation(true);
  }

  if (awaitingConfirmation) {
    return (
      <div>
        <div className="mb-4 flex h-[46px] w-[46px] items-center justify-center rounded-xl bg-accent-weak text-[22px]">
          📧
        </div>
        <h1 className="mb-1.5 text-2xl font-bold tracking-tight">Check your email</h1>
        <p className="text-text-2">
          We sent a confirmation link to <b className="text-text">{email}</b>. Click it to
          activate your workspace, then come back and sign in.
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
      <h1 className="mb-1.5 text-2xl font-bold tracking-tight">Create your workspace</h1>
      <p className="mb-[26px] text-text-2">Start your 14-day trial. No card required.</p>
      <form onSubmit={handleSubmit} className="flex flex-col gap-3.5">
        <div className="flex gap-3">
          <div className="flex-1">
            <Field
              label="First name"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              required
            />
          </div>
          <div className="flex-1">
            <Field
              label="Last name"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              required
            />
          </div>
        </div>
        <Field
          label="Work email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <div>
          <Field
            label="Password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={8}
            required
          />
          <div className="mt-2 flex gap-[5px]">
            {[0, 1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-1 flex-1 rounded-[3px]"
                style={{ background: i < strength ? "var(--green)" : "var(--border)" }}
              />
            ))}
          </div>
        </div>
        {error && <p className="text-[13px] font-medium text-red">{error}</p>}
        <Button type="submit" disabled={loading} className="w-full">
          {loading ? "Creating…" : "Create account"}
        </Button>
      </form>
      <p className="mt-6 text-center text-[13.5px] text-text-2">
        Already have an account?{" "}
        <Link href="/login" className="font-semibold text-accent-text">
          Sign in
        </Link>
      </p>
    </div>
  );
}
