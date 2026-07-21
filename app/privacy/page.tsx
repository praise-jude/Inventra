import { CURRENT_TERMS_VERSION } from "@/lib/terms";

export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-[680px] px-8 py-14 text-text">
      <h1 className="mb-1.5 text-2xl font-bold tracking-tight">Privacy Policy</h1>
      <p className="mb-6 text-[12.5px] text-muted">
        Version {CURRENT_TERMS_VERSION} — Royal Inventra (web and mobile)
      </p>

      <div className="space-y-6 leading-relaxed text-text-2">
        <p>
          Royal Inventra (&quot;we&quot;, &quot;us&quot;) provides inventory and point-of-sale
          software for businesses, available on the web and as a mobile app. This policy
          explains what data we collect, why, and how it&apos;s handled, across both.
        </p>

        <section>
          <h2 className="mb-1.5 text-[15px] font-semibold text-text">Information we collect</h2>
          <ul className="list-disc space-y-1.5 pl-5">
            <li>
              <strong>Account information:</strong> your name, email address, and password
              (handled by our authentication provider, Supabase — we never see or store your
              plaintext password). If you sign in with Google, we receive your name and email
              from Google.
            </li>
            <li>
              <strong>Business information:</strong> your business name, contact email, country,
              and the operational data you or your team enter — products, stock levels, sales,
              customers, suppliers, expenses, and similar records needed to run the app.
            </li>
            <li>
              <strong>Payment information:</strong> subscription billing is processed by Paystack.
              We never receive or store your full card number — only a card brand, last 4 digits,
              and expiry date, for display purposes (e.g. &quot;Visa ending 4242&quot;).
            </li>
            <li>
              <strong>Device permissions (mobile app):</strong> camera access, used only to scan
              barcodes and take product photos when you choose to; photo library access, used
              only when you choose to attach an existing photo to a product. Neither is accessed
              in the background.
            </li>
            <li>
              <strong>Push notification token:</strong> if you enable notifications on the mobile
              app, we store a device token (via Expo/Firebase) so we can deliver alerts like low
              stock warnings or team approval requests. This token is removed when you sign out.
            </li>
            <li>
              <strong>Usage and security logs:</strong> sign-in timestamps, IP address at the time
              of legal-terms acceptance, and an audit trail of account actions (e.g. who edited a
              product or recorded a sale), used for security and account recovery.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="mb-1.5 text-[15px] font-semibold text-text">How we use this information</h2>
          <ul className="list-disc space-y-1.5 pl-5">
            <li>To operate the core features of the app — inventory, sales, reporting, and team management.</li>
            <li>To authenticate you and keep your account secure, including optional two-factor authentication.</li>
            <li>To process subscription payments and send billing-related emails.</li>
            <li>To send notifications you&apos;ve enabled (stock alerts, approvals, account activity).</li>
            <li>To investigate and prevent fraud, abuse, or unauthorized access.</li>
          </ul>
        </section>

        <section>
          <h2 className="mb-1.5 text-[15px] font-semibold text-text">Who we share data with</h2>
          <p className="mb-1.5">
            We don&apos;t sell your data. We share the minimum necessary with the service
            providers that make the app work:
          </p>
          <ul className="list-disc space-y-1.5 pl-5">
            <li><strong>Supabase</strong> — database hosting and authentication.</li>
            <li><strong>Paystack</strong> — payment processing for subscriptions.</li>
            <li><strong>Resend</strong> — transactional email delivery (receipts, alerts, account notices).</li>
            <li><strong>Expo / Google Firebase Cloud Messaging</strong> — push notification delivery on the mobile app.</li>
            <li><strong>Vercel</strong> — web application hosting.</li>
          </ul>
          <p className="mt-1.5">
            Each of these processes data only on our behalf and under their own security and
            privacy commitments. If your organization is on a team plan, your name, role, and
            activity within that organization are visible to your organization&apos;s admins/owner,
            as needed for them to manage their own business.
          </p>
        </section>

        <section>
          <h2 className="mb-1.5 text-[15px] font-semibold text-text">Data retention and deletion</h2>
          <p>
            We retain your data for as long as your account is active. If you close your account
            or request deletion, we delete your personal account data within a reasonable period,
            except where we&apos;re required to retain records (e.g. billing history) for legal or
            accounting purposes. To request deletion, contact us using the details below.
          </p>
        </section>

        <section>
          <h2 className="mb-1.5 text-[15px] font-semibold text-text">Your rights</h2>
          <p>
            You can access, correct, or export most of your data directly within the app
            (Settings). You may also contact us to request a copy of your data, a correction, or
            deletion of your account.
          </p>
        </section>

        <section>
          <h2 className="mb-1.5 text-[15px] font-semibold text-text">Security</h2>
          <p>
            Data is encrypted in transit (HTTPS/TLS). Access to your organization&apos;s data is
            enforced at the database level (row-level security), so accounts can only see data
            belonging to their own organization. Passwords are hashed and never stored in plain
            text. Optional two-factor authentication is available for extra account protection.
          </p>
        </section>

        <section>
          <h2 className="mb-1.5 text-[15px] font-semibold text-text">Children&apos;s privacy</h2>
          <p>
            Royal Inventra is a business tool and is not directed at, or knowingly used to
            collect data from, children under 13.
          </p>
        </section>

        <section>
          <h2 className="mb-1.5 text-[15px] font-semibold text-text">Changes to this policy</h2>
          <p>
            If we make material changes to this policy, we&apos;ll update the version date above
            and, where required, ask you to re-accept it.
          </p>
        </section>

        <section>
          <h2 className="mb-1.5 text-[15px] font-semibold text-text">Contact us</h2>
          <p>
            Questions about this policy or your data? Email{" "}
            <a href="mailto:privacy@royalinventra.com.ng" className="font-semibold text-accent-text">
              privacy@royalinventra.com.ng
            </a>
            .
          </p>
        </section>
      </div>
    </div>
  );
}
