"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Field } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";

export default function AcceptInvitePage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const supabase = createClient();

    const { data: userData, error: updateError } = await supabase.auth.updateUser({ password });
    if (updateError) {
      setError(updateError.message);
      setLoading(false);
      return;
    }

    if (userData.user) {
      await supabase.from("profiles").update({ status: "active" }).eq("id", userData.user.id);
    }

    setLoading(false);
    router.push("/mfa-setup");
  }

  return (
    <div>
      <h1 className="mb-1.5 text-2xl font-bold tracking-tight">Join your team</h1>
      <p className="mb-[26px] text-text-2">Set a password to activate your Stockwell account.</p>
      <form onSubmit={handleSubmit} className="flex flex-col gap-3.5">
        <Field
          label="Password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          minLength={8}
          required
        />
        {error && <p className="text-[13px] font-medium text-red">{error}</p>}
        <Button type="submit" disabled={loading} className="w-full">
          {loading ? "Setting up…" : "Activate account"}
        </Button>
      </form>
    </div>
  );
}
