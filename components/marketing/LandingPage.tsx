import dynamic from "next/dynamic";
import { cookies } from "next/headers";
import { Navbar } from "./Navbar";
import { Hero } from "./Hero";
import { TrustedBy } from "./TrustedBy";
import { Features } from "./Features";
import { DashboardShowcase } from "./DashboardShowcase";
import { MobileShowcase } from "./MobileShowcase";
import { WhyInventra } from "./WhyInventra";
import { AISection } from "./AISection";
import { CTA } from "./CTA";
import { Footer } from "./Footer";

const Pricing = dynamic(() => import("./Pricing").then((m) => m.Pricing));
const Testimonials = dynamic(() => import("./Testimonials").then((m) => m.Testimonials));
const Stats = dynamic(() => import("./Stats").then((m) => m.Stats));
const FAQ = dynamic(() => import("./FAQ").then((m) => m.FAQ));

export async function LandingPage() {
  const cookieStore = await cookies();
  const initialTheme = cookieStore.get("theme")?.value === "dark" ? "dark" : "light";

  return (
    <div className="min-h-screen bg-bg">
      <Navbar initialTheme={initialTheme} />
      <main>
        <Hero />
        <TrustedBy />
        <Features />
        <DashboardShowcase />
        <MobileShowcase />
        <WhyInventra />
        <AISection />
        <Stats />
        <Pricing />
        <Testimonials />
        <FAQ />
        <CTA />
      </main>
      <Footer />
    </div>
  );
}
