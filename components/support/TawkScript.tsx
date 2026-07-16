"use client";

import Script from "next/script";

// Loaded only when explicitly enabled with both IDs set (Support Settings
// admin page) — never mounts a broken widget off placeholder/empty values.
// strategy="lazyOnload" defers this until the browser is idle, after
// everything else has rendered and hydrated, so it can't block or slow the
// initial page load.
export function TawkScript({ propertyId, widgetId }: { propertyId: string; widgetId: string }) {
  return (
    // No crossOrigin attribute — Tawk's embed server doesn't send CORS
    // response headers, so requesting it in CORS mode gets blocked by the
    // browser entirely. A plain classic script tag loads in "no-cors" mode
    // by default, which is what every third-party embed script relies on.
    <Script id="tawk-to-widget" strategy="lazyOnload" src={`https://embed.tawk.to/${propertyId}/${widgetId}`} />
  );
}
