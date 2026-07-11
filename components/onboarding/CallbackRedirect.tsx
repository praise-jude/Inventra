"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// The webhook (the real source of truth) usually lands within a second or
// two of the redirect back from Paystack's checkout — this short delay
// gives it time to process before we send the user onward, so middleware
// sees the updated subscription state rather than bouncing them back.
export function CallbackRedirect({ to }: { to: string }) {
  const router = useRouter();
  useEffect(() => {
    const t = setTimeout(() => router.push(to), 2500);
    return () => clearTimeout(t);
  }, [router, to]);
  return null;
}
