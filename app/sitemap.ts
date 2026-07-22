import type { MetadataRoute } from "next";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://inventra.app";

export default function sitemap(): MetadataRoute.Sitemap {
  const routes = ["/", "/login", "/signup", "/privacy", "/terms", "/api-docs"];
  return routes.map((route) => ({
    url: `${siteUrl}${route}`,
    lastModified: new Date(),
    changeFrequency: route === "/" ? "weekly" : "monthly",
    priority: route === "/" ? 1 : 0.6,
  }));
}
