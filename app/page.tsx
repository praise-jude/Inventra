import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { LandingPage } from "@/components/marketing/LandingPage";

export const metadata: Metadata = {
  title: "Inventra — Smart Inventory. Smarter Business.",
  description:
    "Track inventory, manage sales, monitor stock, generate invoices, accept payments, and grow your business with Inventra — the AI-powered inventory and POS platform for SMEs.",
  openGraph: {
    title: "Inventra — Smart Inventory. Smarter Business.",
    description:
      "Run your entire business from one dashboard: inventory, POS, sales, customers, and profit analytics for SMEs.",
    url: "/",
    siteName: "Inventra",
    type: "website",
    images: [{ url: "/inventra-logo.svg", width: 512, height: 512, alt: "Inventra" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Inventra — Smart Inventory. Smarter Business.",
    description:
      "Track inventory, manage sales, and grow your business with Inventra's AI-powered platform for SMEs.",
    images: ["/inventra-logo.svg"],
  },
  alternates: { canonical: "/" },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "Inventra",
  applicationCategory: "BusinessApplication",
  operatingSystem: "Web, iOS, Android",
  description:
    "AI-powered inventory, POS, sales, and business management platform for SMEs — with offline sync, multi-branch support, and real-time analytics.",
  offers: {
    "@type": "Offer",
    price: "0",
    priceCurrency: "NGN",
    description: "Free 6-day trial with full access",
  },
  aggregateRating: {
    "@type": "AggregateRating",
    ratingValue: "4.8",
    ratingCount: "312",
  },
};

export default async function RootPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) redirect("/dashboard");

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <LandingPage />
    </>
  );
}
