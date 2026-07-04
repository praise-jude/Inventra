"use client";

import { ErrorState } from "@/components/app/ErrorState";

export default function AuthSegmentError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <ErrorState error={error} reset={reset} homeHref="/login" homeLabel="Back to sign in" />;
}
