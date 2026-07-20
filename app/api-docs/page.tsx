"use client";

import Script from "next/script";
import { useEffect, useState } from "react";

declare global {
  interface Window {
    SwaggerUIBundle?: {
      (config: Record<string, unknown>): void;
      presets: { apis: unknown };
    };
  }
}

// Swagger UI loaded from CDN rather than the swagger-ui-react npm package —
// this is the only page in the app that needs it, so pulling in the full
// package (and its own React/CSS bundling quirks) for one route isn't
// worth it. Renders against /api/v1/openapi.json, the hand-written spec
// kept alongside the app/api/v1/** routes.
export default function ApiDocsPage() {
  const [scriptLoaded, setScriptLoaded] = useState(false);

  useEffect(() => {
    if (!scriptLoaded || !window.SwaggerUIBundle) return;
    window.SwaggerUIBundle({
      url: "/api/v1/openapi.json",
      dom_id: "#swagger-ui",
      presets: [window.SwaggerUIBundle.presets.apis],
    });
  }, [scriptLoaded]);

  return (
    <>
      <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css" />
      <Script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js" onLoad={() => setScriptLoaded(true)} />
      <div style={{ padding: "20px 24px 0" }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>Inventra Public API</h1>
        <p style={{ fontSize: 13, color: "#6b7280", marginTop: 4 }}>
          Generate a key from Settings &gt; API Keys in your Inventra workspace, then click &quot;Authorize&quot; below.
        </p>
      </div>
      <div id="swagger-ui" />
    </>
  );
}
