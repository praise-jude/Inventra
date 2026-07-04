"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";

export function ErrorState({
  error,
  reset,
  homeHref = "/dashboard",
  homeLabel = "Go to dashboard",
}: {
  error: Error & { digest?: string };
  reset: () => void;
  homeHref?: string;
  homeLabel?: string;
}) {
  useEffect(() => {
    console.error("[Inventra] Unhandled render error:", error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 p-8 text-center">
      <div className="flex h-[46px] w-[46px] items-center justify-center rounded-xl bg-red-weak text-[22px]">⚠️</div>
      <div>
        <h1 className="text-xl font-bold tracking-tight">Something went wrong</h1>
        <p className="mt-1.5 max-w-[420px] text-text-2">
          An unexpected error occurred. Try again, or head back — if it keeps happening, let us know.
        </p>
        {error.digest && <p className="mt-2 font-mono text-[11px] text-muted">Reference: {error.digest}</p>}
      </div>
      <div className="flex gap-2.5">
        <Link
          href={homeHref}
          className="inline-flex h-[44px] items-center justify-center rounded-[9px] border border-border bg-surface px-4 text-[14px] font-semibold text-text hover:bg-hover"
        >
          {homeLabel}
        </Link>
        <Button onClick={reset}>Try again</Button>
      </div>
    </div>
  );
}
