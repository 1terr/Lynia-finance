import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Privacy Policy — Lynia Finance',
  description:
    'How Lynia Finance collects, uses, and protects your personal information.',
  openGraph: {
    title: 'Privacy Policy — Lynia Finance',
    description:
      'How Lynia Finance collects, uses, and protects your personal information.',
    url: '/privacy',
  },
};

export default function PrivacyPage() {
  return (
    <div className="pt-[72px]">
      {/* Header */}
      <section className="bg-primary-light py-16 lg:py-20">
        <div className="container-main">
          <h1 className="text-display-mobile lg:text-display text-primary-dark">
            Privacy Policy
          </h1>
          <p className="text-body text-slate mt-3">
            Last updated: February 2026
          </p>
        </div>
      </section>

      {/* Content */}
      <section className="py-16 lg:py-20">
        <div className="mx-auto max-w-narrow px-6 lg:px-12">
          <div className="prose-lynia space-y-10">
            <div>
              <h2 className="text-heading text-primary-dark mb-4">
                1. Introduction
              </h2>
              <p className="text-body text-slate">
                Lynia Finance (&quot;we&quot;, &quot;us&quot;, &quot;our&quot;)
                is committed to protecting the privacy and security of your
                personal information. This Privacy Policy explains how we
                collect, use, store, and share your data when you use our
                services, including our WhatsApp-based lending platform, asset
                financing products, and related services.
              </p>
            </div>

            <div>
              <h2 className="text-heading text-primary-dark mb-4">
                2. Information we collect
              </h2>
              <p className="text-body text-slate mb-3">
                We collect the following categories of personal information:
              </p>
              <ul className="list-disc pl-6 space-y-2 text-body text-slate">
                <li>
                  <strong>Identity information:</strong> Full name, national ID
                  number, date of birth, and photograph for KYC verification.
                </li>
                <li>
                  <strong>Contact information:</strong> Phone number, WhatsApp
                  number, email address, and physical address.
                </li>
                <li>
                  <strong>Financial information:</strong> Mobile money
                  transaction history, income declarations, loan repayment
                  records, and credit assessment data.
                </li>
                <li>
                  <strong>Device information:</strong> For asset financing — device
                  IMEI, model, and usage status.
                </li>
                <li>
                  <strong>Usage data:</strong> Interactions with our WhatsApp
                  service, website visits, and application usage patterns.
                </li>
              </ul>
            </div>

            <div>
              <h2 className="text-heading text-primary-dark mb-4">
                3. How we use your information
              </h2>
              <ul className="list-disc pl-6 space-y-2 text-body text-slate">
                <li>Processing loan applications and credit assessments</li>
                <li>Verifying your identity (KYC compliance)</li>
                <li>Managing asset financing and device tracking</li>
                <li>Processing payments and repayments via mobile money</li>
                <li>Communicating with you about your account and services</li>
                <li>Improving our products and credit scoring models</li>
                <li>Complying with legal and regulatory requirements</li>
              </ul>
            </div>

            <div>
              <h2 className="text-heading text-primary-dark mb-4">
                4. Data sharing
              </h2>
              <p className="text-body text-slate mb-3">
                We may share your information with:
              </p>
              <ul className="list-disc pl-6 space-y-2 text-body text-slate">
                <li>
                  <strong>KYC verification providers</strong> (e.g., Smile
                  Identity) to verify your identity.
                </li>
                <li>
                  <strong>Payment processors</strong> (EcoCash, OneMoney) to
                  process transactions.
                </li>
                <li>
                  <strong>Regulatory authorities</strong> including the Reserve
                  Bank of Zimbabwe, as required by law.
                </li>
                <li>
                  <strong>Device management partners</strong> for asset
                  financing device lock/unlock services.
                </li>
              </ul>
              <p className="text-body text-slate mt-3">
                We never sell your personal data to third parties for marketing
                purposes.
              </p>
            </div>

            <div>
              <h2 className="text-heading text-primary-dark mb-4">
                5. Data security
              </h2>
              <p className="text-body text-slate">
                We implement industry-standard security measures to protect your
                data, including encryption at rest and in transit (TLS 1.3),
                access controls, and regular security audits. Sensitive data
                such as national ID numbers and biometric information is stored
                with field-level encryption.
              </p>
            </div>

            <div>
              <h2 className="text-heading text-primary-dark mb-4">
                6. Data retention
              </h2>
              <p className="text-body text-slate">
                We retain your personal data in accordance with Reserve Bank of
                Zimbabwe regulations: transaction records for 7 years, KYC
                documents for 10 years, and audit logs for 5 years. You may
                request deletion of non-regulated data at any time.
              </p>
            </div>

            <div>
              <h2 className="text-heading text-primary-dark mb-4">
                7. Your rights
              </h2>
              <ul className="list-disc pl-6 space-y-2 text-body text-slate">
                <li>Request access to the personal data we hold about you</li>
                <li>Request correction of inaccurate information</li>
                <li>
                  Request deletion of your data (subject to regulatory retention
                  requirements)
                </li>
                <li>Withdraw consent for non-essential data processing</li>
                <li>Request a copy of your data in a portable format</li>
              </ul>
              <p className="text-body text-slate mt-3">
                To exercise any of these rights, contact us at{' '}
                <a
                  href="mailto:privacy@lyniafinance.com"
                  className="text-primary hover:text-primary-hover underline"
                >
                  privacy@lyniafinance.com
                </a>
                .
              </p>
            </div>

            <div>
              <h2 className="text-heading text-primary-dark mb-4">
                8. Contact us
              </h2>
              <p className="text-body text-slate">
                If you have questions about this Privacy Policy or how we handle
                your data, please contact us at{' '}
                <a
                  href="mailto:privacy@lyniafinance.com"
                  className="text-primary hover:text-primary-hover underline"
                >
                  privacy@lyniafinance.com
                </a>{' '}
                or visit our{' '}
                <a
                  href="/contact"
                  className="text-primary hover:text-primary-hover underline"
                >
                  contact page
                </a>
                .
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
