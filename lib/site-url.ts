import "server-only";
import { headers } from "next/headers";

// Canonical origin used to build auth email redirect links (invite,
// confirmation, password reset). Prefers NEXT_PUBLIC_SITE_URL so production
// always redirects to the app's real domain regardless of what host/proxy
// served the request; falls back to the request's own Host header when the
// env var isn't set (e.g. local dev). NEXT_PUBLIC_SITE_URL must also be
// registered in Supabase Dashboard -> Authentication -> URL Configuration ->
// Redirect URLs, or Supabase silently ignores the redirectTo we pass and
// falls back to its own configured Site URL instead.
export async function siteUrl(): Promise<string> {
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL;
  if (process.env.NODE_ENV === "production") {
    console.warn(
      "[Inventra] NEXT_PUBLIC_SITE_URL is not set in production — auth redirect links will be built from the request's Host header, which is not guaranteed correct behind every proxy/CDN. Set NEXT_PUBLIC_SITE_URL in the deployment's environment variables.",
    );
  }
  const h = await headers();
  const host = h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "https";
  return `${proto}://${host}`;
}
