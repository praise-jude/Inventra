import type { NextConfig } from "next";

// Product images are served from this project's Supabase Storage public
// bucket (see lib/actions/products.ts:uploadProductImage) — next/image needs
// the host allow-listed to optimize them. Derived from the same env var
// every other Supabase client already uses, so it never drifts out of sync.
const supabaseHostname = process.env.NEXT_PUBLIC_SUPABASE_URL
  ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname
  : undefined;

const nextConfig: NextConfig = {
  images: {
    remotePatterns: supabaseHostname
      ? [{ protocol: "https", hostname: supabaseHostname, pathname: "/storage/v1/object/public/**" }]
      : [],
  },
};

export default nextConfig;
