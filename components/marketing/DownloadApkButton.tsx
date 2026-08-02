"use client";

import type { ReactNode } from "react";
import { recordApkDownload } from "@/lib/actions/platform-stats";

export function DownloadApkButton({
  apkUrl,
  fileName,
  className,
  children,
}: {
  apkUrl: string;
  fileName: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <a
      href={apkUrl}
      download={fileName}
      className={className}
      onClick={() => {
        // Fire-and-forget — the browser's native download (via the
        // `download` attribute) proceeds regardless of this call.
        void recordApkDownload();
      }}
    >
      {children}
    </a>
  );
}
