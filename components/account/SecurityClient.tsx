"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { generateAndStoreRecoveryCodes, disableMfaWithPassword } from "@/lib/actions/mfa";
import { useToast } from "@/components/app/ToastProvider";
import { Field } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";

type View = "status" | "enroll-qr" | "enroll-verify" | "recovery-codes" | "disable";

interface Props {
  mfaEnabled: boolean;
  recoveryCodeCount: number;
}

export function SecurityClient({ mfaEnabled: initialEnabled, recoveryCodeCount: initialCount }: Props) {
  const router = useRouter();
  const flash = useToast();
  const [view, setView] = useState<View>("status");
  const [mfaEnabled, setMfaEnabled] = useState(initialEnabled);
  const [recoveryCodeCount, setRecoveryCodeCount] = useState(initialCount);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [factorId, setFactorId] = useState("");
  const [qrCode, setQrCode] = useState("");
  const [manualSecret, setManualSecret] = useState("");
  const [verifyCode, setVerifyCode] = useState("");
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);

  const [disablePassword, setDisablePassword] = useState("");
  const [disableCode, setDisableCode] = useState("");

  async function startEnroll() {
    setError(null);
    setBusy(true);
    try {
      const supabase = createClient();
      const { data, error: enrollError } = await supabase.auth.mfa.enroll({ factorType: "totp" });
      if (enrollError) throw enrollError;
      setFactorId(data.id);
      setQrCode(data.totp.qr_code);
      setManualSecret(data.totp.secret);
      setView("enroll-qr");
    } catch (err) {
      flash(err instanceof Error ? err.message : "Could not start setup.");
    } finally {
      setBusy(false);
    }
  }

  async function cancelEnroll() {
    const supabase = createClient();
    await supabase.auth.mfa.unenroll({ factorId }).catch(() => {});
    setFactorId("");
    setQrCode("");
    setManualSecret("");
    setVerifyCode("");
    setView("status");
  }

  async function confirmEnroll() {
    setError(null);
    setBusy(true);
    try {
      const supabase = createClient();
      const challenge = await supabase.auth.mfa.challenge({ factorId });
      if (challenge.error) throw challenge.error;
      const verify = await supabase.auth.mfa.verify({
        factorId,
        challengeId: challenge.data.id,
        code: verifyCode.trim(),
      });
      if (verify.error) throw verify.error;

      const codes = await generateAndStoreRecoveryCodes();
      setRecoveryCodes(codes);
      setRecoveryCodeCount(codes.length);
      setMfaEnabled(true);
      setView("recovery-codes");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Invalid code. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  function finishRecoveryCodes() {
    setRecoveryCodes([]);
    setVerifyCode("");
    setView("status");
    flash("Two-factor authentication is now on.");
    router.refresh();
  }

  function downloadRecoveryCodes() {
    const blob = new Blob([recoveryCodes.join("\n") + "\n"], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "inventra-recovery-codes.txt";
    a.click();
    URL.revokeObjectURL(url);
  }

  async function copyRecoveryCodes() {
    await navigator.clipboard.writeText(recoveryCodes.join("\n"));
    flash("Recovery codes copied.");
  }

  async function handleDisable(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await disableMfaWithPassword({ password: disablePassword, code: disableCode });
      setMfaEnabled(false);
      setRecoveryCodeCount(0);
      setDisablePassword("");
      setDisableCode("");
      setView("status");
      flash("Two-factor authentication is now off.");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not disable two-factor authentication.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="max-w-[560px] animate-fade-up">
      <div className="mb-[18px]">
        <div className="text-[22px] font-bold tracking-tight">Security</div>
        <div className="mt-[3px] text-text-2">Manage how you sign in to your account.</div>
      </div>

      {view === "status" && (
        <div className="rounded-2xl border border-border bg-surface p-5 shadow-[var(--shadow-sm)]">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-[14px] font-bold">Two-factor authentication</div>
              <div className="mt-1 text-[12.5px] text-text-2">
                Adds a second step at sign-in using a code from an authenticator app (Google Authenticator, Authy,
                1Password, etc.) — so a stolen password alone isn&apos;t enough to get into your account.
              </div>
            </div>
            <span
              className="ml-4 flex-shrink-0 rounded-[20px] px-[10px] py-[3px] text-[11.5px] font-bold uppercase tracking-[0.03em]"
              style={
                mfaEnabled
                  ? { color: "var(--green)", background: "var(--green-weak)" }
                  : { color: "var(--muted)", background: "var(--hover)" }
              }
            >
              {mfaEnabled ? "Enabled" : "Disabled"}
            </span>
          </div>

          {mfaEnabled && (
            <div className="mt-3.5 rounded-[10px] border border-border bg-surface-2 px-3.5 py-3 text-[12.5px] text-text-2">
              {recoveryCodeCount} recovery code{recoveryCodeCount === 1 ? "" : "s"} remaining. Recovery codes let you
              sign in if you lose access to your authenticator app.
            </div>
          )}

          <div className="mt-4">
            {mfaEnabled ? (
              <Button variant="secondary" onClick={() => setView("disable")}>
                Disable two-factor authentication
              </Button>
            ) : (
              <Button onClick={startEnroll} disabled={busy}>
                {busy ? "Starting…" : "Enable two-factor authentication"}
              </Button>
            )}
          </div>
        </div>
      )}

      {view === "enroll-qr" && (
        <div className="rounded-2xl border border-border bg-surface p-5 shadow-[var(--shadow-sm)]">
          <div className="text-[14px] font-bold">Scan this QR code</div>
          <ol className="mt-2 list-decimal pl-5 text-[12.5px] text-text-2">
            <li>Open your authenticator app (Google Authenticator, Authy, 1Password, etc.)</li>
            <li>Tap the + button to add a new account</li>
            <li>Scan the QR code below, or enter the key manually</li>
          </ol>
          <div className="my-4 flex justify-center">
            {/* eslint-disable-next-line @next/next/no-img-element -- data: URI from Supabase, not an optimizable asset */}
            <img src={qrCode} alt="MFA QR code" className="h-[180px] w-[180px] rounded-[10px] border border-border" />
          </div>
          <div className="mb-4 rounded-[9px] border border-border bg-surface-2 px-3.5 py-2.5 text-center font-mono text-[13px]">
            {manualSecret}
          </div>
          <Button onClick={() => setView("enroll-verify")} className="w-full">
            Continue
          </Button>
          <button
            type="button"
            onClick={cancelEnroll}
            className="mt-2.5 block w-full text-center text-[12.5px] font-semibold text-text-2"
          >
            Cancel
          </button>
        </div>
      )}

      {view === "enroll-verify" && (
        <div className="rounded-2xl border border-border bg-surface p-5 shadow-[var(--shadow-sm)]">
          <div className="text-[14px] font-bold">Enter the 6-digit code</div>
          <div className="mt-1 text-[12.5px] text-text-2">From your authenticator app, to confirm setup.</div>
          <div className="mt-3.5">
            <Field
              value={verifyCode}
              onChange={(e) => setVerifyCode(e.target.value.trim())}
              placeholder="123456"
              inputMode="numeric"
              maxLength={6}
              autoFocus
            />
          </div>
          {error && <p className="mt-2 text-[12.5px] font-medium text-red">{error}</p>}
          <Button onClick={confirmEnroll} disabled={busy || verifyCode.length !== 6} className="mt-3.5 w-full">
            {busy ? "Verifying…" : "Verify & enable"}
          </Button>
          <button
            type="button"
            onClick={cancelEnroll}
            className="mt-2.5 block w-full text-center text-[12.5px] font-semibold text-text-2"
          >
            Cancel
          </button>
        </div>
      )}

      {view === "recovery-codes" && (
        <div className="rounded-2xl border border-border bg-surface p-5 shadow-[var(--shadow-sm)]">
          <div className="text-[14px] font-bold">Save your recovery codes</div>
          <div className="mt-1 text-[12.5px] text-text-2">
            Each code can be used once to sign in if you lose access to your authenticator app. Store them
            somewhere safe — this is the only time they&apos;ll be shown.
          </div>
          <div className="mt-3.5 grid grid-cols-2 gap-2 rounded-[10px] border border-border bg-surface-2 p-3.5 font-mono text-[13px]">
            {recoveryCodes.map((code) => (
              <div key={code}>{code}</div>
            ))}
          </div>
          <div className="mt-3.5 flex gap-2">
            <Button variant="secondary" onClick={copyRecoveryCodes} className="flex-1">
              Copy
            </Button>
            <Button variant="secondary" onClick={downloadRecoveryCodes} className="flex-1">
              Download
            </Button>
          </div>
          <Button onClick={finishRecoveryCodes} className="mt-3.5 w-full">
            I&apos;ve saved these codes
          </Button>
        </div>
      )}

      {view === "disable" && (
        <form onSubmit={handleDisable} className="rounded-2xl border border-border bg-surface p-5 shadow-[var(--shadow-sm)]">
          <div className="text-[14px] font-bold">Disable two-factor authentication</div>
          <div className="mt-1 text-[12.5px] text-text-2">
            Confirm your password and a current code (from your authenticator app, or a recovery code) to turn this
            off.
          </div>
          <div className="mt-3.5 flex flex-col gap-3">
            <Field
              type="password"
              label="Password"
              value={disablePassword}
              onChange={(e) => setDisablePassword(e.target.value)}
              required
            />
            <Field
              label="Authentication code or recovery code"
              value={disableCode}
              onChange={(e) => setDisableCode(e.target.value.trim())}
              placeholder="123456 or HDT4-9XPA"
              required
            />
          </div>
          {error && <p className="mt-2 text-[12.5px] font-medium text-red">{error}</p>}
          <Button type="submit" disabled={busy} className="mt-3.5 w-full">
            {busy ? "Disabling…" : "Disable two-factor authentication"}
          </Button>
          <button
            type="button"
            onClick={() => {
              setError(null);
              setDisablePassword("");
              setDisableCode("");
              setView("status");
            }}
            className="mt-2.5 block w-full text-center text-[12.5px] font-semibold text-text-2"
          >
            Cancel
          </button>
        </form>
      )}
    </div>
  );
}
