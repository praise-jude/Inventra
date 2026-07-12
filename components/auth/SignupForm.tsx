"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { registerAccount } from "@/lib/actions/auth";
import { COUNTRIES, statesForCountry } from "@/lib/geo/countries";
import {
  validateFullName,
  validateEmail,
  validateBusinessName,
  validateBusinessEmail,
  validatePassword,
  passwordStrength,
  PASSWORD_RULES,
} from "@/lib/validation/auth";
import { Field } from "@/components/ui/Field";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";

const ROLE_OPTIONS = [
  { value: "admin", label: "Admin" },
  { value: "manager", label: "Manager" },
  { value: "staff", label: "Staff" },
] as const;

export function SignupForm() {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [businessName, setBusinessName] = useState("");
  const [businessEmail, setBusinessEmail] = useState("");
  const [country, setCountry] = useState("");
  const [state, setState] = useState("");
  const [role, setRole] = useState<(typeof ROLE_OPTIONS)[number]["value"]>("admin");
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [awaitingConfirmation, setAwaitingConfirmation] = useState(false);

  const states = useMemo(() => statesForCountry(country), [country]);
  const strength = passwordStrength(password);

  const fieldErrors = {
    fullName: validateFullName(fullName),
    email: validateEmail(email),
    businessName: validateBusinessName(businessName),
    businessEmail: validateBusinessEmail(businessEmail),
    password: validatePassword(password),
    country: country ? null : "Country is required.",
    terms: termsAccepted ? null : "You must accept the Terms & Conditions and Privacy Policy.",
  };
  const showError = (key: keyof typeof fieldErrors) => (submitted ? fieldErrors[key] : null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitted(true);
    setError(null);
    if (Object.values(fieldErrors).some(Boolean)) return;

    setLoading(true);
    const result = await registerAccount({
      fullName,
      email,
      password,
      businessName,
      businessEmail: businessEmail || undefined,
      country,
      state: state || undefined,
      role,
      termsAccepted,
    });
    setLoading(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }

    if (result.hasSession) {
      router.push("/dashboard");
      return;
    }
    setAwaitingConfirmation(true);
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
      <p className="mb-[26px] text-text-2">Start your 6-day free trial — a card is required to activate it.</p>
      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-3.5">
        <div>
          <Field label="Full name" value={fullName} onChange={(e) => setFullName(e.target.value)} />
          {showError("fullName") && <p className="mt-1 text-[12px] font-medium text-red">{showError("fullName")}</p>}
        </div>
        <div>
          <Field label="Email address" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          {showError("email") && <p className="mt-1 text-[12px] font-medium text-red">{showError("email")}</p>}
        </div>
        <div>
          <div className="relative">
            <Field
              label="Password"
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="pr-12"
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="absolute right-3 top-[30px] text-[12.5px] font-semibold text-text-2"
            >
              {showPassword ? "Hide" : "Show"}
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
              <li
                key={rule.key}
                className="text-[11.5px]"
                style={{ color: rule.test(password) ? "var(--green)" : "var(--muted)" }}
              >
                {rule.test(password) ? "✓" : "○"} {rule.label}
              </li>
            ))}
          </ul>
          {showError("password") && <p className="mt-1 text-[12px] font-medium text-red">{showError("password")}</p>}
        </div>

        <div className="my-1 h-px bg-border" />

        <div>
          <Field label="Business name" value={businessName} onChange={(e) => setBusinessName(e.target.value)} />
          {showError("businessName") && (
            <p className="mt-1 text-[12px] font-medium text-red">{showError("businessName")}</p>
          )}
        </div>
        <div>
          <Field
            label="Business email (optional)"
            type="email"
            value={businessEmail}
            onChange={(e) => setBusinessEmail(e.target.value)}
          />
          {showError("businessEmail") && (
            <p className="mt-1 text-[12px] font-medium text-red">{showError("businessEmail")}</p>
          )}
        </div>
        <div className="flex gap-3">
          <div className="flex-1">
            <Select
              label="Country"
              value={country}
              onChange={(e) => {
                setCountry(e.target.value);
                setState("");
              }}
            >
              <option value="">Select country…</option>
              {COUNTRIES.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.name}
                </option>
              ))}
            </Select>
            {showError("country") && <p className="mt-1 text-[12px] font-medium text-red">{showError("country")}</p>}
          </div>
          {states.length > 0 && (
            <div className="flex-1">
              <Select label="State/Province" value={state} onChange={(e) => setState(e.target.value)}>
                <option value="">Select state…</option>
                {states.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </Select>
            </div>
          )}
        </div>

        <div>
          <Select label="Your role" value={role} onChange={(e) => setRole(e.target.value as typeof role)}>
            {ROLE_OPTIONS.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </Select>
          <p className="mt-1.5 text-[11.5px] text-muted">
            As the creator of a new business, you&apos;ll have full owner access — this just helps us
            tailor your setup.
          </p>
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
        {showError("terms") && <p className="text-[12px] font-medium text-red">{showError("terms")}</p>}

        {error && <p className="text-[13px] font-medium text-red">{error}</p>}
        <Button type="submit" disabled={loading} className="w-full">
          {loading ? "Creating…" : "Create account"}
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
        Already have an account?{" "}
        <Link href="/login" className="font-semibold text-accent-text">
          Sign in
        </Link>
      </p>
    </div>
  );
}
