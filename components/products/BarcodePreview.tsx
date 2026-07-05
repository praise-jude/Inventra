"use client";

import { useEffect, useRef } from "react";
import JsBarcode from "jsbarcode";

export function BarcodePreview({ value, className }: { value: string | null | undefined; className?: string }) {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!svgRef.current) return;
    if (!value) {
      svgRef.current.innerHTML = "";
      return;
    }
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
      svgRef.current.innerHTML = "";
    }
  }, [value]);

  if (!value) return null;
  return <svg ref={svgRef} className={className} />;
}
