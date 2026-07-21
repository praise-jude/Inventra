import { CURRENT_TERMS_VERSION } from "@/lib/terms";

export default function TermsPage() {
  return (
    <div className="mx-auto max-w-[680px] px-8 py-14 text-text">
      <h1 className="mb-1.5 text-2xl font-bold tracking-tight">Terms &amp; Conditions</h1>
      <p className="mb-6 text-[12.5px] text-muted">
        Version {CURRENT_TERMS_VERSION} — Royal Inventra (web and mobile)
      </p>

      <div className="space-y-6 leading-relaxed text-text-2">
        <p>
          These terms govern your use of Royal Inventra, an inventory and point-of-sale
          application available on the web and as a mobile app. By creating an account, you agree
          to these terms.
        </p>

        <section>
          <h2 className="mb-1.5 text-[15px] font-semibold text-text">Your account</h2>
          <p>
            You&apos;re responsible for the accuracy of the information you provide and for
            keeping your login credentials secure. The person who creates an organization is its
            Owner and can invite team members under roles (Admin, Manager, Cashier, Warehouse)
            with different levels of access. Owners/Admins are responsible for the actions of
            accounts they invite into their organization.
          </p>
        </section>

        <section>
          <h2 className="mb-1.5 text-[15px] font-semibold text-text">Free trial and subscriptions</h2>
          <p>
            New organizations get a 6-day free trial with full access, which requires a payment
            card to activate. Once the trial ends, your card is charged automatically for the
            plan (Monthly or Yearly) you selected, and your subscription auto-renews at the end of
            each billing period until cancelled. You can cancel anytime from Billing settings —
            access continues until the end of the period you&apos;ve already paid for, with no
            further charges after that. Prices are shown in the app before you&apos;re charged.
          </p>
        </section>

        <section>
          <h2 className="mb-1.5 text-[15px] font-semibold text-text">Payments</h2>
          <p>
            Payments are processed by Paystack. We don&apos;t store your full card details. Failed
            renewal payments may result in temporarily restricted access until payment succeeds or
            your payment method is updated.
          </p>
        </section>

        <section>
          <h2 className="mb-1.5 text-[15px] font-semibold text-text">Your data</h2>
          <p>
            You retain ownership of the business data you enter (products, sales, customers, and
            similar records). We process it to provide the service, as described in our{" "}
            <a href="/privacy" className="font-semibold text-accent-text">Privacy Policy</a>. You&apos;re
            responsible for the accuracy and legality of the data you enter, and for having any
            necessary rights or consents to enter your customers&apos; information into the app.
          </p>
        </section>

        <section>
          <h2 className="mb-1.5 text-[15px] font-semibold text-text">Acceptable use</h2>
          <p>
            You agree not to misuse the service — including attempting to bypass its access
            controls, interfering with other organizations&apos; data, or using it for unlawful
            purposes. We may suspend accounts that violate this.
          </p>
        </section>

        <section>
          <h2 className="mb-1.5 text-[15px] font-semibold text-text">Availability and changes</h2>
          <p>
            We aim to keep the service reliably available but don&apos;t guarantee uninterrupted
            access. We may update or change features over time, and will update these terms when
            changes are material — the version date above tracks when that happens.
          </p>
        </section>

        <section>
          <h2 className="mb-1.5 text-[15px] font-semibold text-text">Cancellation and termination</h2>
          <p>
            You may cancel your subscription or close your account at any time. We may suspend or
            terminate accounts that violate these terms or that we reasonably believe pose a
            security risk to the service or other organizations.
          </p>
        </section>

        <section>
          <h2 className="mb-1.5 text-[15px] font-semibold text-text">Limitation of liability</h2>
          <p>
            The service is provided &quot;as is.&quot; To the extent permitted by law, we&apos;re
            not liable for indirect or consequential losses arising from your use of the service.
            Nothing here limits liability where it can&apos;t legally be limited.
          </p>
        </section>

        <section>
          <h2 className="mb-1.5 text-[15px] font-semibold text-text">Contact us</h2>
          <p>
            Questions about these terms? Email{" "}
            <a href="mailto:support@royalinventra.com.ng" className="font-semibold text-accent-text">
              support@royalinventra.com.ng
            </a>
            .
          </p>
        </section>
      </div>
    </div>
  );
}
