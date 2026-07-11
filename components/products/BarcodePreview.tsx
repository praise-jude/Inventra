"use client";

import { useEffect, useRef } from "react";

export function BarcodePreview({ value, className }: { value: string | null | undefined; className?: string }) {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!svgRef.current) return;
    if (!value) {
      svgRef.current.innerHTML = "";
      return;
    }
    let cancelled = false;
    import("jsbarcode").then(({ default: JsBarcode }) => {
      if (cancelled || !svgRef.current) return;
      try {
        JsBarcode(svgRef.current, value, {
          format: /^\d+$/.test(value) && value.length === 13 ? "EAN13" : "CODE128",
          height: 40,
          width: 1.6,
          fontSize: 12,
          margin: 6,
          background: "transparent",
        });
      } catch {
        if (svgRef.current) svgRef.current.innerHTML = "";
      }
    });
    return () => {
      cancelled = true;
    };
  }, [value]);

  if (!value) return null;
  return <svg ref={svgRef} className={className} />;
}
