import type { Metadata } from "next";
import { DeleteAccountRequestForm } from "@/components/account/DeleteAccountRequestForm";

export const metadata: Metadata = {
  title: "Delete your account",
  description: "Request deletion of your Royal Inventra account and associated data.",
};

export default function DeleteAccountPage() {
  return (
    <div className="mx-auto max-w-[680px] px-8 py-14 text-text">
      <h1 className="mb-1.5 text-2xl font-bold tracking-tight">Delete your account</h1>
      <p className="mb-6 text-[13px] text-muted">Royal Inventra (web and mobile)</p>

      <div className="mb-8 space-y-4 leading-relaxed text-text-2">
        <p>
          You can request deletion of your Royal Inventra account and associated personal data at
          any time, whether or not you still have the app installed, using the form below.
        </p>

        <section>
          <h2 className="mb-1.5 text-[15px] font-semibold text-text">What gets deleted</h2>
          <ul className="list-disc space-y-1.5 pl-5">
            <li>Your profile — name, email address, and login credentials.</li>
            <li>
              If you&apos;re the sole owner of your organization, all associated business data
              (products, sales, stock movements, customers, suppliers, expenses, and team
              records).
            </li>
            <li>
              If you&apos;re a member of a team, only your own profile and login are removed —
              your organization&apos;s business data stays with the workspace, since it belongs to
              the business rather than to you individually. Ask your workspace owner to remove
              you if you&apos;d prefer that route instead.
            </li>
            <li>Device push-notification tokens and stored device permissions.</li>
          </ul>
        </section>

        <section>
          <h2 className="mb-1.5 text-[15px] font-semibold text-text">What we retain, and why</h2>
          <p>
            Some records — such as billing/payment history — may be retained after deletion where
            we&apos;re legally required to keep them for accounting or tax purposes. Everything
            else is deleted within 30 days of a verified request.
          </p>
        </section>

        <section>
          <h2 className="mb-1.5 text-[15px] font-semibold text-text">How it works</h2>
          <p>
            Submit the form below with the email address on your account. We&apos;ll email you a
            confirmation immediately, verify the request, and follow up once deletion is complete.
            You can also email{" "}
            <a href="mailto:privacy@royalinventra.com.ng" className="font-semibold text-accent-text">
              privacy@royalinventra.com.ng
            </a>{" "}
            directly if you&apos;d rather not use the form.
          </p>
        </section>
      </div>

      <DeleteAccountRequestForm />
    </div>
  );
}
