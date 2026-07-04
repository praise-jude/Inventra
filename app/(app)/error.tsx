"use client";

import { ErrorState } from "@/components/app/ErrorState";

export default function AppSegmentError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <ErrorState error={error} reset={reset} homeHref="/dashboard" homeLabel="Go to dashboard" />;
}
