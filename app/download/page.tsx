import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { cookies } from "next/headers";
import {
  Download,
  ShieldCheck,
  Smartphone,
  CalendarDays,
  HardDrive,
  PackageCheck,
  Monitor,
  Apple,
  Terminal,
  PlayCircle,
  Mail,
  Boxes,
  ShoppingCart,
  ScanLine,
  Users,
  Receipt,
  BarChart3,
  UserCog,
  RefreshCw,
  Package,
} from "lucide-react";
import { Navbar } from "@/components/marketing/Navbar";
import { Footer } from "@/components/marketing/Footer";
import { APP_RELEASES, getLatestRelease } from "@/lib/releases";

export const metadata: Metadata = {
  title: "Download Royal Inventra",
  description: "Get Royal Inventra on Android today, with Windows, macOS, Linux, and app store listings coming soon.",
};

// Platforms without a real build yet — each just needs comingSoon flipped
// to false and its own release data wired in once it actually ships;
// nothing else about this page needs to change (see the Windows/macOS/
// Linux/store cards below, all driven from this one list).
const COMING_SOON_PLATFORMS = [
  { key: "windows", name: "Windows", icon: Monitor, note: "Desktop app for Windows 10 & 11 (64-bit)" },
  { key: "macos", name: "macOS", icon: Apple, note: "Desktop app for Apple Silicon & Intel Macs" },
  { key: "linux", name: "Linux", icon: Terminal, note: "Desktop app for major distributions" },
  { key: "google-play", name: "Google Play", icon: PlayCircle, note: "Official Play Store listing" },
  { key: "app-store", name: "Apple App Store", icon: Apple, note: "Official App Store listing" },
];

// Only features actually shipped in the app — deliberately excludes
// "Offline Support" (no offline mutation queue exists anywhere in this
// app) and overstated "backup/restore" claims, matching the same
// no-lying-to-visitors bar the platform cards above are held to.
const FEATURES = [
  { icon: Boxes, label: "Inventory Management" },
  { icon: ShoppingCart, label: "Point of Sale" },
  { icon: ScanLine, label: "Barcode Scanning" },
  { icon: Package, label: "Supply Records" },
  { icon: Users, label: "Customer Management" },
  { icon: Receipt, label: "Expense Tracking" },
  { icon: BarChart3, label: "Sales & Profit Reports" },
  { icon: UserCog, label: "Team & Role-Based Access" },
  { icon: RefreshCw, label: "Real-Time Cloud Sync" },
];

export default async function DownloadPage() {
  const cookieStore = await cookies();
  const initialTheme = cookieStore.get("theme")?.value === "dark" ? "dark" : "light";
  const latest = getLatestRelease();
  const history = APP_RELEASES.slice(1);

  return (
    <div className="min-h-screen bg-bg">
      <Navbar initialTheme={initialTheme} />
      <main className="mx-auto max-w-4xl px-5 py-20 sm:px-8">
        <div className="text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-accent-weak">
            <Image src="/inventra-logo.svg" alt="" width={36} height={36} />
          </div>
          <h1 className="mt-5 text-[32px] font-extrabold leading-tight tracking-tight text-text sm:text-[42px]">
            Download Royal Inventra
          </h1>
          <p className="mx-auto mt-4 max-w-lg text-[16px] leading-relaxed text-text-2">
            Run your business from anywhere — sales, inventory, supply records, and your team, all in one app.
          </p>
        </div>

        {/* ANDROID — the one real, working download */}
        <div className="mt-10 rounded-[20px] border border-border bg-surface p-6 shadow-[var(--shadow-sm)] sm:p-8">
          <div className="flex flex-col items-center gap-6 sm:flex-row sm:justify-between">
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-[10px] bg-accent-weak">
                <Smartphone size={20} className="text-accent-text" />
              </span>
              <div>
                <div className="flex items-center gap-2 text-[13px] font-semibold text-text-2">
                  <PackageCheck size={15} className="text-accent-text" />
                  Android · Latest version
                </div>
                <div className="mt-0.5 text-[22px] font-bold text-text">v{latest.version}</div>
              </div>
            </div>
            <a
              href={latest.apkUrl}
              download={`royal-inventra-v${latest.version}.apk`}
              className="inline-flex h-[52px] items-center justify-center gap-2 rounded-[10px] bg-accent px-7 text-[15px] font-bold text-white shadow-[var(--shadow-lg)] transition-transform hover:-translate-y-0.5"
            >
              <Download size={18} />
              Download Android APK
            </a>
          </div>

          <div className="mt-7 grid grid-cols-2 gap-3 border-t border-border pt-6 sm:grid-cols-4">
            <div className="flex flex-col items-center gap-1.5 text-center">
              <CalendarDays size={16} className="text-muted" />
              <span className="text-[11px] text-muted">Released</span>
              <span className="text-[13px] font-semibold text-text">{latest.releasedAt}</span>
            </div>
            <div className="flex flex-col items-center gap-1.5 text-center">
              <HardDrive size={16} className="text-muted" />
              <span className="text-[11px] text-muted">File size</span>
              <span className="text-[13px] font-semibold text-text">{latest.fileSizeMb > 0 ? `${latest.fileSizeMb} MB` : "—"}</span>
            </div>
            <div className="flex flex-col items-center gap-1.5 text-center">
              <Smartphone size={16} className="text-muted" />
              <span className="text-[11px] text-muted">Requires</span>
              <span className="text-[13px] font-semibold text-text">Android {latest.minAndroidVersion}+</span>
            </div>
            <div className="flex flex-col items-center gap-1.5 text-center">
              <ShieldCheck size={16} className="text-muted" />
              <span className="text-[11px] text-muted">Signed build</span>
              <span className="text-[13px] font-semibold text-text">EAS verified</span>
            </div>
          </div>
        </div>

        <div className="mt-4 rounded-[14px] border border-border bg-surface-2 p-4 text-[12.5px] leading-relaxed text-text-2">
          Android may warn that this is an app from outside the Play Store — that&apos;s expected while
          we&apos;re not yet listed there. Tap <strong className="text-text">&quot;Install anyway&quot;</strong> to
          continue.
        </div>

        {/* FEATURES — only what's actually shipped */}
        <div className="mt-14">
          <h2 className="text-[18px] font-bold text-text">What you get</h2>
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {FEATURES.map((f) => (
              <div key={f.label} className="flex items-center gap-2.5 rounded-xl border border-border bg-surface px-3.5 py-3">
                <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-accent-weak text-accent-text">
                  <f.icon size={15} />
                </span>
                <span className="text-[12.5px] font-semibold text-text-2">{f.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* OTHER PLATFORMS — honest placeholders, no fake download links */}
        <div className="mt-14">
          <h2 className="text-[18px] font-bold text-text">More platforms</h2>
          <p className="mt-1 text-[13px] text-text-2">We&apos;re working on it — here&apos;s what&apos;s next.</p>
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
            {COMING_SOON_PLATFORMS.map((p) => (
              <div key={p.key} className="flex items-center gap-3.5 rounded-[14px] border border-border bg-surface p-4">
                <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-[10px] bg-border-2 text-muted">
                  <p.icon size={18} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-[13.5px] font-semibold text-text">{p.name}</div>
                  <div className="truncate text-[11.5px] text-muted">{p.note}</div>
                </div>
                <span className="flex-shrink-0 rounded-full bg-amber-weak px-2.5 py-1 text-[10.5px] font-bold text-amber">
                  Coming soon
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-14">
          <h2 className="text-[18px] font-bold text-text">What&apos;s new</h2>
          <ul className="mt-3 flex flex-col gap-2">
            {latest.releaseNotes.map((note) => (
              <li key={note} className="flex items-start gap-2.5 text-[14px] text-text-2">
                <span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-accent" />
                {note}
              </li>
            ))}
          </ul>
        </div>

        {history.length > 0 && (
          <div className="mt-10">
            <h2 className="text-[18px] font-bold text-text">Version history</h2>
            <div className="mt-3 flex flex-col gap-2">
              {history.map((r) => (
                <div
                  key={r.version}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-[12px] border border-border bg-surface px-4 py-3"
                >
                  <div>
                    <span className="text-[13.5px] font-semibold text-text">v{r.version}</span>
                    <span className="ml-2 text-[12px] text-muted">{r.releasedAt}</span>
                  </div>
                  <a href={r.apkUrl} download={`royal-inventra-v${r.version}.apk`} className="text-[12.5px] font-semibold text-accent-text">
                    Download
                  </a>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="mt-14 flex flex-col items-center gap-3 rounded-[16px] border border-dashed border-border p-6 text-center">
          <p className="text-[13.5px] font-semibold text-text">Prefer to manage inventory from a browser?</p>
          <Link href="/signup" className="text-[13.5px] font-semibold text-accent-text">
            Start free on the web →
          </Link>
          <a
            href="mailto:hello@royalinventra.com.ng"
            className="mt-2 inline-flex items-center gap-1.5 text-[12.5px] text-muted hover:text-text-2"
          >
            <Mail size={13} />
            Need help? hello@royalinventra.com.ng
          </a>
        </div>
      </main>
      <Footer />
    </div>
  );
}
