import type { Metadata } from "next";
import { Hanken_Grotesk, JetBrains_Mono } from "next/font/google";
import Script from "next/script";
import { getSupportSettings } from "@/lib/queries/support-settings";
import { SupportWidget } from "@/components/support/SupportWidget";
import "./globals.css";

// Runs before hydration (Next's beforeInteractive strategy inlines this
// into the initial HTML, ahead of any content paint) so the right
// data-theme is applied with no flash — without this layout needing to
// read the theme cookie itself via next/headers' cookies(). That mattered:
// calling cookies() anywhere in the root layout forces every single route
// in the app into fully dynamic, uncached rendering (Next 16's default is
// "dynamic unless nothing here reads per-request data"), which meant even
// pure marketing/legal pages were hitting the origin on every visit instead
// of being served from Vercel's CDN. The authenticated (app) route group
// still reads its own session cookie independently and stays dynamic —
// correctly, since that's private per-org data — this only affects pages
// that have no other reason to be dynamic.
const THEME_INIT_SCRIPT = `
(function () {
  try {
    var match = document.cookie.match(/(?:^|; )theme=([^;]*)/);
    var stored = match ? decodeURIComponent(match[1]) : null;
    var theme = stored === "dark" || stored === "light"
      ? stored
      : (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    document.documentElement.setAttribute("data-theme", theme);
  } catch (e) {}
})();
`;

const hanken = Hanken_Grotesk({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-hanken",
  display: "swap",
});

const jetbrains = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-jetbrains",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "https://inventra.app"),
  title: {
    default: "Inventra — Smart Inventory. Smarter Business.",
    template: "%s | Inventra",
  },
  description: "Real-time stock, supplier orders, and profit analytics for modern retail.",
  icons: {
    icon: "/inventra-logo.svg",
    shortcut: "/inventra-logo.svg",
    apple: "/inventra-logo.svg",
  },
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  // Every page, logged in or not (login/signup included) — fetched once
  // per request via the service-role client, never exposed to the
  // anon-key client, so no RLS policy is needed for this read. Doesn't
  // itself force dynamic rendering (createAdminClient() never touches
  // cookies()/headers()) — only the removed theme-cookie read did that.
  const supportSettings = await getSupportSettings();

  return (
    <html lang="en" className={`${hanken.variable} ${jetbrains.variable}`} suppressHydrationWarning>
      <body suppressHydrationWarning>
        <Script id="theme-init" strategy="beforeInteractive">
          {THEME_INIT_SCRIPT}
        </Script>
        {children}
        <SupportWidget settings={supportSettings} />
      </body>
    </html>
  );
}
