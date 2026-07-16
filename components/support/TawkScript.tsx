"use client";

import Script from "next/script";

// Loaded only when explicitly enabled with both IDs set (Support Settings
// admin page) — never mounts a broken widget off placeholder/empty values.
// strategy="lazyOnload" defers this until the browser is idle, after
// everything else has rendered and hydrated, so it can't block or slow the
// initial page load.
//
// Tawk auto-injects its own floating launcher bubble once loaded — separate
// from our custom WhatsApp button (SupportWidget.tsx). Both default to the
// same bottom-right corner and would otherwise stack on top of each other.
// Tawk_API.customStyle repositions Tawk's own bubble above ours; it must be
// set before the embed script runs, so this follows Tawk's own official
// snippet structure (init the API object, then inject the script tag)
// rather than next/script's plain `src` prop. Deliberately omits the
// `crossorigin` attribute from Tawk's official snippet — Tawk's embed
// server doesn't send CORS response headers, so requesting it in CORS mode
// gets blocked by the browser entirely; a plain classic script tag loads in
// "no-cors" mode by default, which is what actually works.
export function TawkScript({ propertyId, widgetId }: { propertyId: string; widgetId: string }) {
  return (
    <Script id="tawk-to-widget" strategy="lazyOnload">
      {`
        var Tawk_API = window.Tawk_API || {};
        var Tawk_LoadStart = new Date();
        Tawk_API.customStyle = {
          visibility: {
            // Our WhatsApp button (SupportWidget.tsx) sits 24px (20px on
            // mobile) off the corner and is 56px tall, so its top edge is
            // ~80px up from the bottom-right corner — yOffset here is
            // Tawk's own distance from that same corner, so 100px leaves a
            // clean ~20px gap instead of the two bubbles touching/stacking
            // flush against each other.
            desktop: { xOffset: 16, yOffset: 100, position: 'br' },
            mobile: { xOffset: 12, yOffset: 96, position: 'br' }
          }
        };
        window.Tawk_API = Tawk_API;
        window.Tawk_LoadStart = Tawk_LoadStart;
        (function(){
          var s1 = document.createElement("script"), s0 = document.getElementsByTagName("script")[0];
          s1.async = true;
          s1.src = ${JSON.stringify(`https://embed.tawk.to/${propertyId}/${widgetId}`)};
          s1.charset = 'UTF-8';
          s0.parentNode.insertBefore(s1, s0);
        })();
      `}
    </Script>
  );
}
