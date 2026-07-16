"use client";

import { useEffect, useRef, useState } from "react";
import type { SupportSettings } from "@/lib/queries/support-settings";

declare global {
  interface Window {
    Tawk_API?: { toggle?: () => void; maximize?: () => void };
  }
}

function WhatsAppIcon({ size = 26 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.46 1.32 4.96L2.05 22l5.25-1.38a9.9 9.9 0 0 0 4.74 1.21h.005c5.46 0 9.9-4.45 9.9-9.91 0-2.65-1.03-5.14-2.9-7.01A9.86 9.86 0 0 0 12.04 2Zm5.8 14.02c-.24.68-1.4 1.3-1.94 1.38-.5.08-1.12.11-1.8-.11a16.5 16.5 0 0 1-1.7-.63c-3-1.3-4.95-4.32-5.1-4.52-.15-.2-1.22-1.62-1.22-3.1s.78-2.2 1.06-2.5c.27-.3.6-.37.8-.37s.4 0 .58.01c.19.01.44-.07.68.53.25.6.85 2.08.92 2.23.08.15.13.33.02.53-.1.2-.15.32-.3.5-.15.17-.31.39-.44.52-.15.15-.3.31-.13.6.17.3.76 1.26 1.63 2.04 1.12 1 2.06 1.31 2.36 1.46.3.15.47.13.65-.08.17-.2.73-.85.93-1.15.19-.29.38-.24.64-.14.26.1 1.66.78 1.94.93.28.14.47.21.53.33.07.12.07.68-.17 1.35Z" />
    </svg>
  );
}

export function SupportWidget({ settings }: { settings: SupportSettings }) {
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("click", onDocClick);
    return () => document.removeEventListener("click", onDocClick);
  }, []);

  if (!settings.widgetEnabled || (!settings.whatsappEnabled && !settings.tawkEnabled)) return null;

  const whatsappUrl = `https://wa.me/${settings.whatsappNumber}?text=${encodeURIComponent(settings.whatsappMessage)}`;

  function startLiveChat() {
    setOpen(false);
    if (window.Tawk_API?.maximize) window.Tawk_API.maximize();
    else if (window.Tawk_API?.toggle) window.Tawk_API.toggle();
  }

  return (
    <div ref={panelRef} className="fixed bottom-5 right-5 z-40 sm:bottom-6 sm:right-6">
      {open && (
        <div
          role="dialog"
          aria-label="Support options"
          className="animate-scale-in mb-3 w-[280px] rounded-2xl border border-border bg-surface p-[18px] shadow-[var(--shadow-lg)]"
        >
          <div className="text-[15px] font-bold">Need help?</div>
          <ul className="mt-2.5 flex flex-col gap-1 text-[12.5px] text-text-2">
            {settings.tawkEnabled && <li>✓ Live chat</li>}
            {settings.whatsappEnabled && <li>✓ WhatsApp support</li>}
          </ul>
          {settings.businessHours && (
            <div className="mt-3 rounded-[10px] bg-surface-2 p-2.5 text-[12px] text-text-2">
              <div className="font-semibold text-text">Business hours</div>
              <div className="mt-0.5">{settings.businessHours}</div>
              {settings.averageResponse && <div className="mt-1.5">Average response: {settings.averageResponse}</div>}
            </div>
          )}
          <div className="mt-3.5 flex flex-col gap-2">
            {settings.tawkEnabled && (
              <button
                type="button"
                onClick={startLiveChat}
                className="h-[38px] rounded-[9px] border-none bg-accent text-[13px] font-semibold text-white"
              >
                Start live chat
              </button>
            )}
            {settings.whatsappEnabled && (
              <a
                href={whatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => setOpen(false)}
                className="flex h-[38px] items-center justify-center gap-1.5 rounded-[9px] border border-border bg-surface text-[13px] font-semibold text-text hover:bg-hover"
              >
                Chat on WhatsApp
              </a>
            )}
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? "Close support options" : "Open support options"}
        aria-expanded={open}
        className="flex h-14 w-14 items-center justify-center rounded-full text-white shadow-[var(--shadow-lg)] transition-transform hover:scale-105"
        style={{ background: "#25D366" }}
      >
        <WhatsAppIcon />
      </button>
    </div>
  );
}
