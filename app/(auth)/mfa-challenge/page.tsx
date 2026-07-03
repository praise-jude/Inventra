"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";

export default function MfaChallengePage() {
  const router = useRouter();
  const [factorId, setFactorId] = useState<string | null>(null);
  const [digits, setDigits] = useState<string[]>(Array(6).fill(""));
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [preparing, setPreparing] = useState(true);
  const inputsRef = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    async function prepare() {
      const supabase = createClient();
      const { data, error: listError } = await supabase.auth.mfa.listFactors();
      if (listError) {
        setError(listError.message);
        setPreparing(false);
        return;
      }
      const verified = (data?.totp ?? []).find((f) => f.status === "verified");
      if (!verified) {
        router.replace("/mfa-setup");
        return;
      }
      setFactorId(verified.id);
      setPreparing(false);
    }
    prepare();
  }, [router]);

  function handleDigit(i: number, value: string) {
    const v = value.replace(/\D/g, "").slice(-1);
    const next = [...digits];
    next[i] = v;
    setDigits(next);
    if (v && i < 5) inputsRef.current[i + 1]?.focus();
  }

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    if (!factorId) return;
    const code = digits.join("");
    if (code.length !== 6) {
      setError("Enter all 6 digits.");
      return;
    }
    setError(null);
    setLoading(true);
    const supabase = createClient();
    const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({
      factorId,
    });
    if (challengeError) {
      setError(challengeError.message);
      setLoading(false);
      return;
    }
    const { error: verifyError } = await supabase.auth.mfa.verify({
      factorId,
      challengeId: challenge.id,
      code,
    });
    setLoading(false);
    if (verifyError) {
      setError("Incorrect code. Try again.");
      setDigits(Array(6).fill(""));
      inputsRef.current[0]?.focus();
      return;
    }
    router.push("/dashboard");
  }

  if (preparing) {
    return <p className="text-text-2">Checking your account…</p>;
  }

  return (
    <div>
      <div className="mb-4 flex h-[46px] w-[46px] items-center justify-center rounded-xl bg-accent-weak text-[22px]">
        🔐
      </div>
      <h1 className="mb-1.5 text-2xl font-bold tracking-tight">Two-factor auth</h1>
      <p className="mb-[26px] text-text-2">Enter the 6-digit code from your authenticator app.</p>
      <form onSubmit={handleVerify}>
        <div className="mb-5 flex gap-[9px]">
          {digits.map((d, i) => (
            <input
              key={i}
              ref={(el) => {
                inputsRef.current[i] = el;
              }}
              value={d}
              onChange={(e) => handleDigit(i, e.target.value)}
              maxLength={1}
              inputMode="numeric"
              className="h-[54px] w-full rounded-[10px] border-[1.5px] border-border bg-surface text-center font-mono text-[22px] font-bold text-text outline-none focus:border-accent"
            />
          ))}
        </div>
        {error && <p className="mb-4 text-[13px] font-medium text-red">{error}</p>}
        <Button type="submit" disabled={loading} className="w-full">
          {loading ? "Verifying…" : "Verify & continue"}
        </Button>
      </form>
    </div>
  );
}
