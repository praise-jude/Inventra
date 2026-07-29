import type { NextConfig } from "next";

// Product images are served from this project's Supabase Storage public
// bucket (see lib/actions/products.ts:uploadProductImage) — next/image needs
// the host allow-listed to optimize them. Derived from the same env var
// every other Supabase client already uses, so it never drifts out of sync.
const supabaseHostname = process.env.NEXT_PUBLIC_SUPABASE_URL
  ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname
  : undefined;

// Pragmatic CSP, not a maximal one: 'unsafe-inline'/'unsafe-eval' on
// script-src are still needed because Next.js's own hydration inline
// scripts aren't nonce-tagged here (that requires per-request nonces
// wired through middleware, a bigger change needing live browser
// verification this environment can't do). Still meaningfully restricts
// which *domains* can load a script/style/connect/frame at all — the
// main thing that blocks a leaked-secret or injected-script attack from
// exfiltrating to an attacker-controlled origin. unpkg.com is allow-listed
// only for app/api-docs's Swagger UI (the one page in the app that loads
// it from a CDN instead of bundling it).
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline' 'unsafe-eval' https://unpkg.com`,
  `style-src 'self' 'unsafe-inline' https://unpkg.com`,
  `img-src 'self' data: blob:${supabaseHostname ? ` https://${supabaseHostname}` : ""} https://storage.googleapis.com`,
  "font-src 'self' data:",
  `connect-src 'self'${supabaseHostname ? ` https://${supabaseHostname} wss://${supabaseHostname}` : ""}`,
  "frame-ancestors 'none'",
  "form-action 'self'",
  "base-uri 'self'",
  "object-src 'none'",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), interest-cohort=()" },
];

const nextConfig: NextConfig = {
  images: {
    remotePatterns: supabaseHostname
      ? [{ protocol: "https", hostname: supabaseHostname, pathname: "/storage/v1/object/public/**" }]
      : [],
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
