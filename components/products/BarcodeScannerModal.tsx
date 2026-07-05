"use client";

import { useEffect, useId, useRef, useState } from "react";

export function BarcodeScannerModal({
  onDetected,
  onClose,
}: {
  onDetected: (code: string) => void;
  onClose: () => void;
}) {
  const elementId = `barcode-scanner-${useId().replace(/[:]/g, "")}`;
  const scannerRef = useRef<import("html5-qrcode").Html5Qrcode | null>(null);
  const stoppedRef = useRef(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function start() {
      const { Html5Qrcode, Html5QrcodeSupportedFormats } = await import("html5-qrcode");
      if (cancelled) return;

      const scanner = new Html5Qrcode(elementId, {
        formatsToSupport: [
          Html5QrcodeSupportedFormats.EAN_13,
          Html5QrcodeSupportedFormats.EAN_8,
          Html5QrcodeSupportedFormats.UPC_A,
          Html5QrcodeSupportedFormats.UPC_E,
          Html5QrcodeSupportedFormats.CODE_128,
          Html5QrcodeSupportedFormats.CODE_39,
          Html5QrcodeSupportedFormats.QR_CODE,
        ],
        verbose: false,
      });
      scannerRef.current = scanner;

      try {
        await scanner.start(
          { facingMode: "environment" },
          { fps: 10, qrbox: { width: 250, height: 150 } },
          (decodedText) => {
            if (stoppedRef.current) return;
            stoppedRef.current = true;
            onDetected(decodedText);
          },
          () => {
            // per-frame decode misses — expected while aiming, not an error
          },
        );
      } catch {
        if (!cancelled) setError("Could not access the camera. Check camera permissions and try again.");
      }
    }

    start();

    return () => {
      cancelled = true;
      const scanner = scannerRef.current;
      if (scanner) {
        scanner
          .stop()
          .catch(() => {})
          .finally(() => scanner.clear());
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [elementId]);

  return (
    <div
      onClick={onClose}
      className="animate-fade-in fixed inset-0 z-[80] flex items-center justify-center bg-[rgba(15,20,32,.6)] p-6"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="animate-scale-in w-full max-w-[420px] rounded-2xl border border-border bg-surface shadow-[var(--shadow-lg)]"
      >
        <div className="flex items-center justify-between border-b border-border px-[22px] py-[18px]">
          <div className="text-[16px] font-bold">Scan barcode</div>
          <button type="button" onClick={onClose} className="h-8 w-8 rounded-[8px] border border-border bg-surface text-text">
            ✕
          </button>
        </div>
        <div className="p-5">
          {error ? (
            <p className="text-[13px] font-medium text-red">{error}</p>
          ) : (
            <p className="mb-3 text-[12.5px] text-muted">Point the camera at a barcode or QR code.</p>
          )}
          <div id={elementId} className="overflow-hidden rounded-[10px]" />
        </div>
      </div>
    </div>
  );
}
