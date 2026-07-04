"use client";

import { useEffect } from "react";

// Catches errors thrown by the root layout itself, which app/error.tsx
// cannot — this fully replaces <html>/<body>, so it deliberately avoids any
// Tailwind classes or shared components in case those are what's broken.
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("[Inventra] Fatal root error:", error);
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          display: "flex",
          minHeight: "100vh",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "system-ui, sans-serif",
          padding: 32,
          textAlign: "center",
        }}
      >
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>Something went wrong</h1>
          <p style={{ color: "#666", marginBottom: 16 }}>The application failed to load. Please try again.</p>
          {error.digest && (
            <p style={{ fontFamily: "monospace", fontSize: 11, color: "#999", marginBottom: 16 }}>
              Reference: {error.digest}
            </p>
          )}
          <button
            onClick={reset}
            style={{
              height: 44,
              padding: "0 16px",
              borderRadius: 9,
              border: "none",
              background: "#635bff",
              color: "#fff",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
