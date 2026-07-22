import type { MetadataRoute } from "next";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://inventra.app";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/dashboard", "/admin", "/settings", "/api/", "/onboarding", "/account", "/team", "/billing"],
      },
    ],
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
