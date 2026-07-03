"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";

export default function MfaSetupPage() {
  const router = useRouter();
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [factorId, setFactorId] = useState<string | null>(null);
  const [digits, setDigits] = useState<string[]>(Array(6).fill(""));
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [preparing, setPreparing] = useState(true);
  const inputsRef = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    let cancelled = false;
    async function prepare() {
      const supabase = createClient();

      // A user who already has a verified factor shouldn't be here at all —
      // send them where middleware actually wants them.
      const { data: existing } = await supabase.auth.mfa.listFactors();
      const totpFactors = (existing?.all ?? []).filter((f) => f.factor_type === "totp");
      const alreadyVerified = totpFactors.find((f) => f.status === "verified");
      if (alreadyVerified) {
        router.replace("/dashboard");
        return;
      }
      // Clean up any dangling unverified factor from an abandoned attempt —
      // Supabase blocks re-enrolling under the same friendly name otherwise.
      for (const f of totpFactors) {
        if (f.status === "unverified") {
          await supabase.auth.mfa.unenroll({ factorId: f.id });
        }
      }

      const { data, error: enrollError } = await supabase.auth.mfa.enroll({
        factorType: "totp",
        friendlyName: "Authenticator app",
      });
      if (cancelled) return;
      if (enrollError) {
        setError(enrollError.message);
        setPreparing(false);
        return;
      }
      setFactorId(data.id);
      setQrCode(data.totp.qr_code);
      setSecret(data.totp.secret);
      setPreparing(false);
    }
    prepare();
    return () => {
      cancelled = true;
    };
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
      setError(verifyError.message);
      return;
    }
    router.push("/dashboard");
  }

  if (preparing) {
    return <p className="text-text-2">Setting up two-factor authentication…</p>;
  }

  return (
    <div>
      <div className="mb-4 flex h-[46px] w-[46px] items-center justify-center rounded-xl bg-accent-weak text-[22px]">
        🔐
      </div>
      <h1 className="mb-1.5 text-2xl font-bold tracking-tight">Secure your account</h1>
      <p className="mb-[26px] text-text-2">
        Scan this QR code with an authenticator app (Google Authenticator, 1Password, Authy),
        then enter the 6-digit code it shows you. This is required before you can continue.
      </p>

      {qrCode && (
        <div className="mb-5 flex items-center gap-4 rounded-xl border border-border bg-surface-2 p-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={qrCode} alt="Authenticator QR code" className="h-[110px] w-[110px]" />
          <div className="min-w-0">
            <div className="text-[12px] text-text-2">Can&apos;t scan? Enter this key manually:</div>
            <div className="mt-1 break-all font-mono text-[12px] font-semibold">{secret}</div>
          </div>
        </div>
      )}

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
