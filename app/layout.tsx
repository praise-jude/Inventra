import type { Metadata } from "next";
import { Hanken_Grotesk, JetBrains_Mono } from "next/font/google";
import { cookies } from "next/headers";
import { getSupportSettings } from "@/lib/queries/support-settings";
import { SupportWidget } from "@/components/support/SupportWidget";
import "./globals.css";

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
  title: "Inventra — Inventory that runs itself",
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
  const cookieStore = await cookies();
  const theme = cookieStore.get("theme")?.value === "dark" ? "dark" : "light";
  // Every page, logged in or not (login/signup included) — fetched once
  // per request via the service-role client, never exposed to the
  // anon-key client, so no RLS policy is needed for this read.
  const supportSettings = await getSupportSettings();

  return (
    <html lang="en" data-theme={theme} className={`${hanken.variable} ${jetbrains.variable}`}>
      <body suppressHydrationWarning>
        {children}
        <SupportWidget settings={supportSettings} />
      </body>
    </html>
  );
}
