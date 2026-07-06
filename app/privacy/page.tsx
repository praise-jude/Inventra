import { CURRENT_TERMS_VERSION } from "@/lib/terms";

export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-[680px] px-8 py-14 text-text">
      <h1 className="mb-1.5 text-2xl font-bold tracking-tight">Privacy Policy</h1>
      <p className="mb-6 text-[12.5px] text-muted">Version {CURRENT_TERMS_VERSION}</p>
      <p className="leading-relaxed text-text-2">
        This is placeholder privacy-policy text for Inventra. Replace this page with your
        organization&apos;s actual privacy policy before launch.
      </p>
    </div>
  );
}
