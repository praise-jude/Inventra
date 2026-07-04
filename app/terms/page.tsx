import { CURRENT_TERMS_VERSION } from "@/lib/terms";

export default function TermsPage() {
  return (
    <div className="mx-auto max-w-[680px] px-8 py-14 text-text">
      <h1 className="mb-1.5 text-2xl font-bold tracking-tight">Terms &amp; Conditions</h1>
      <p className="mb-6 text-[12.5px] text-muted">Version {CURRENT_TERMS_VERSION}</p>
      <p className="leading-relaxed text-text-2">
        This is placeholder terms-of-service text for Stockwell. Replace this page with your
        organization&apos;s actual legal terms before launch. Every account acceptance is stamped
        with the version shown above so changes can be tracked over time.
      </p>
    </div>
  );
}
